import { useState, useContext, useMemo } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  FaHome,
  FaClipboardList,
  FaTools,
  FaMoneyBill,
  FaChevronDown,
  FaChevronRight,
  FaPenSquare,
  FaListAlt,
  FaWrench,
  FaClipboardCheck,
  FaUndo,
  FaCogs,
  FaCheckDouble,
  FaScrewdriver,
  FaEye,
  FaUserCog,
  FaSignOutAlt,
  FaDownload,
  FaRoad,
  FaGasPump,
  FaChartBar,
  FaSearch,
  FaRobot,
  FaChartPie,
  FaMicrochip,
  FaExchangeAlt,
  FaFileInvoice,
  FaBuilding,
} from "react-icons/fa";
import { ExternalLink } from "lucide-react";
import logoInova from "../assets/logoInovaQuatai.png";
import { AuthContext } from "../context/AuthContext";

/* =========================
   ROTAS
========================= */

// Desempenho Diesel (módulo atual)
const DIESEL_ROUTES = {
  lancamento: "/desempenho-lancamento",
  resumo: "/desempenho-diesel-resumo",
  acompanhamento: "/desempenho-diesel-acompanhamento",
  agente: "/desempenho-diesel-agente",
};

// ✅ Tratativas Diesel (módulo separado)
const DIESEL_TRATATIVAS_ROUTES = {
  central: "/diesel-tratativas",
};

// Rotas PCM
const PCM_ROUTES = {
  resumo: "/pcm-resumo",
  inicio: "/pcm-inicio",
  diario: "/pcm-diario",
};

// ✅ Rotas Embarcados (modelo novo)
const EMBARCADOS_ROUTES = {
  central: "/embarcados-central",
  movimentacoes: "/embarcados-movimentacoes",
  reparos: "/embarcados-reparos",
  envioManutencao: "/embarcados-envio-manutencao",
};

// ✅ Rotas Estrutura Física
const ESTRUTURA_FISICA_ROUTES = {
  solicitacao: "/estrutura-fisica/solicitacao",
  central: "/estrutura-fisica/central",
  consultar: "/estrutura-fisica/consultar/:id",
  tratar: "/estrutura-fisica/tratar/:id",
};

/* =========================
   FAROL TÁTICO
========================= */
const NIVEIS_LIBERADOS_FAROL = new Set(["Gestor", "Administrador", "RH"]);
const FAROL_URL = "https://faroldemetas.onrender.com/?from=inove";

/* =========================
   ACESSO POR NÍVEL
========================= */

const ACCESS = {
  Administrador: "ALL",

  Gestor: [
    "/",
    "/inove",
    "/inicio-rapido",

    "/solicitar",
    "/central",
    "/tratativas-resumo",
    "/tratativas-rh",

    "/lancar-avaria",
    "/avarias-em-revisao",
    "/aprovar-avarias",
    "/cobrancas",
    "/avarias-resumo",

    "/sos-resumo",
    "/sos-solicitacao",
    "/sos-fechamento",
    "/sos-tratamento",
    "/sos-central",
    "/sos-dashboard",

    "/km-rodado",

    // PCM
    PCM_ROUTES.resumo,
    PCM_ROUTES.inicio,
    PCM_ROUTES.diario,

    // ✅ Embarcados
    ...Object.values(EMBARCADOS_ROUTES),

    // Desempenho Diesel (módulo atual)
    ...Object.values(DIESEL_ROUTES),

    // ✅ Tratativas Diesel (módulo separado)
    ...Object.values(DIESEL_TRATATIVAS_ROUTES),

    // ✅ Estrutura Física
    ESTRUTURA_FISICA_ROUTES.solicitacao,
    ESTRUTURA_FISICA_ROUTES.central,
    ESTRUTURA_FISICA_ROUTES.consultar,
    ESTRUTURA_FISICA_ROUTES.tratar,

    // Checklists
    "/checklists",
  ],

  RH: [
    "/",
    "/tratativas-resumo",
    "/central",
    "/tratativas-rh",
    "/avarias-resumo",
    "/cobrancas",

    // ✅ Tratativas Diesel (módulo separado)
    DIESEL_TRATATIVAS_ROUTES.central,
  ],

  Tratativa: [
    "/inicio-rapido",
    "/solicitar",
    "/central",
    "/cobrancas",

    // ✅ Embarcados - apenas Reparos
    EMBARCADOS_ROUTES.reparos,
  ],

  Manutenção: [
    "/inicio-rapido",
    "/solicitar",

    "/lancar-avaria",
    "/avarias-em-revisao",
    "/aprovar-avarias",

    "/sos-resumo",
    "/sos-fechamento",
    "/sos-tratamento",
    "/sos-central",
    "/sos-dashboard",

    "/km-rodado",

    // PCM
    PCM_ROUTES.resumo,
    PCM_ROUTES.inicio,
    PCM_ROUTES.diario,

    // ✅ Embarcados
    ...Object.values(EMBARCADOS_ROUTES),
  ],

  CCO: [
    "/inicio-rapido",
    "/solicitar",
    "/sos-solicitacao",
    "/sos-fechamento",
    "/sos-dashboard",
    "/km-rodado",

    // ✅ Embarcados - apenas Reparos
    EMBARCADOS_ROUTES.reparos,
  ],

  Instrutor: [
    "/inicio-rapido",
    ...Object.values(DIESEL_ROUTES),
    DIESEL_TRATATIVAS_ROUTES.central,
  ],

  // ✅ NOVO NÍVEL
  Embarcados: [
    "/inicio-rapido",

    // ✅ Embarcados - acesso total ao módulo
    ...Object.values(EMBARCADOS_ROUTES),
  ],
};

function canSee(user, path) {
  if (!user?.nivel) return false;
  if (user.nivel === "Administrador") return true;
  if (user.nivel === "Gestor") return ACCESS.Gestor.includes(path);

  const allowed = ACCESS[user.nivel] || [];
  return allowed.includes(path);
}

export default function Sidebar() {
  const [pcmOpen, setPcmOpen] = useState(false);
  const [desempenhoDieselOpen, setDesempenhoDieselOpen] = useState(false);
  const [tratativasOpen, setTratativasOpen] = useState(false);
  const [avariasOpen, setAvariasOpen] = useState(false);
  const [checklistsOpen, setChecklistsOpen] = useState(false);
  const [intervencoesOpen, setIntervencoesOpen] = useState(false);
  const [embarcadosOpen, setEmbarcadosOpen] = useState(false);
  const [estruturaFisicaOpen, setEstruturaFisicaOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);

  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const isAdmin = user?.nivel === "Administrador";
  const isGestor = user?.nivel === "Gestor";
  const isManutencao = user?.nivel === "Manutenção";
  const isRH = user?.nivel === "RH";
  const isInstrutor = user?.nivel === "Instrutor";
  const isCCO = user?.nivel === "CCO";
  const isTratativa = user?.nivel === "Tratativa";
  const isEmbarcados = user?.nivel === "Embarcados";

  const showInicioExecutivo = isAdmin || isGestor || isRH;
  const showInicioBasico = !showInicioExecutivo;

  const podeVerFarol = useMemo(() => {
    const nivel = String(user?.nivel || "").trim();
    return NIVEIS_LIBERADOS_FAROL.has(nivel);
  }, [user?.nivel]);

  function abrirFarol() {
    try {
      if (user) {
        const payload = {
          origem: "INOVE",
          login: user.login || null,
          nome: user.nome || null,
          nivel: user.nivel || null,
          auth_user_id: user.auth_user_id || null,
          email: user.email || null,
          timestamp: new Date().toISOString(),
        };
        localStorage.setItem("farol_user", JSON.stringify(payload));
      }
    } catch (e) {
      console.warn("Falha ao salvar farol_user:", e);
    }
    window.location.href = FAROL_URL;
  }

  const links = useMemo(
    () => ({
      inicioExecutivo: { path: "/", label: "Início", icon: <FaHome /> },
      inicioBasico: { path: "/inicio-rapido", label: "Início", icon: <FaHome /> },

      pcm: {
        label: "PCM",
        icon: <FaClipboardList />,
        tabs: [
          { path: PCM_ROUTES.resumo, label: "Resumo", icon: <FaChartPie /> },
          { path: PCM_ROUTES.inicio, label: "PCM do dia", icon: <FaPenSquare /> },
        ],
      },

      embarcados: {
        label: "Embarcados",
        icon: <FaMicrochip />,
        tabs: [
          { path: EMBARCADOS_ROUTES.central, label: "Central", icon: <FaListAlt /> },
          { path: EMBARCADOS_ROUTES.movimentacoes, label: "Movimentações", icon: <FaExchangeAlt /> },
          { path: EMBARCADOS_ROUTES.reparos, label: "Reparos", icon: <FaTools /> },
          { path: EMBARCADOS_ROUTES.envioManutencao, label: "Envio Manutenção", icon: <FaFileInvoice /> },
        ],
      },

      desempenhoDiesel: {
        label: "Desempenho Diesel",
        icon: <FaGasPump />,
        tabs: [
          { path: DIESEL_ROUTES.resumo, label: "Resumo", icon: <FaChartBar /> },
          { path: DIESEL_ROUTES.agente, label: "Agente Diesel", icon: <FaRobot /> },
          { path: DIESEL_ROUTES.lancamento, label: "Lançamento Manual", icon: <FaPenSquare /> },
          { path: DIESEL_ROUTES.acompanhamento, label: "Acompanhamento", icon: <FaSearch /> },
          { path: DIESEL_TRATATIVAS_ROUTES.central, label: "Tratativas (Central)", icon: <FaListAlt /> },
        ],
      },

      estruturaFisica: {
        label: "Estrutura Física",
        icon: <FaBuilding />,
        tabs: [
          {
            path: ESTRUTURA_FISICA_ROUTES.solicitacao,
            label: "Solicitação",
            icon: <FaPenSquare />,
          },
          {
            path: ESTRUTURA_FISICA_ROUTES.central,
            label: "Central",
            icon: <FaListAlt />,
          },
        ],
      },

      tratativas: [
        { path: "/tratativas-resumo", label: "Resumo", icon: <FaChartPie />, onlyAdminGestor: true },
        { path: "/solicitar", label: "Solicitação", icon: <FaPenSquare /> },
        { path: "/central", label: "Central", icon: <FaListAlt /> },
        { path: "/tratativas-rh", label: "Tratativas RH", icon: <FaUserCog />, onlyAdminGestorRH: true },
      ],

      avarias: [
        { path: "/avarias-resumo", label: "Resumo", icon: <FaChartPie /> },
        { path: "/lancar-avaria", label: "Lançamento", icon: <FaWrench /> },
        { path: "/avarias-em-revisao", label: "Pendências de Revisão", icon: <FaUndo /> },
        { path: "/aprovar-avarias", label: "Aprovações", icon: <FaClipboardCheck /> },
        { path: "/cobrancas", label: "Cobranças", icon: <FaMoneyBill /> },
      ],

      checklists: [{ path: "/checklists", label: "Central", icon: <FaClipboardCheck /> }],

      sos: [
        { path: "/sos-resumo", label: "Resumo", icon: <FaChartPie /> },
        { path: "/sos-solicitacao", label: "Solicitação", icon: <FaPenSquare /> },
        { path: "/sos-fechamento", label: "Fechamento", icon: <FaCheckDouble /> },
        { path: "/sos-tratamento", label: "Manutenção", icon: <FaScrewdriver /> },
        { path: "/sos-central", label: "Central", icon: <FaEye /> },
        { path: "/sos-dashboard", label: "Dashboard (Excel)", icon: <FaDownload /> },
        { path: "/km-rodado", label: "KM Rodado (Dia)", icon: <FaRoad /> },
      ],

      configuracoes: [{ path: "/usuarios", label: "Usuários", icon: <FaUserCog /> }],
    }),
    []
  );

  const handleLogout = () => {
    if (confirm("Deseja realmente sair?")) {
      logout();
      navigate("/login");
    }
  };

  const navLinkClass = ({ isActive }) =>
    `flex items-center gap-3 px-3 py-2 rounded-lg mb-2 transition-all duration-200 ${
      isActive ? "bg-blue-500" : "hover:bg-blue-600"
    }`;

  const subNavLinkClass = ({ isActive }) =>
    `flex items-center gap-3 px-3 py-2 rounded-lg mb-1 ml-4 transition-all duration-200 text-sm ${
      isActive ? "bg-blue-500" : "hover:bg-blue-600"
    }`;

  const showDesempenhoDiesel = isAdmin || isGestor || isInstrutor || isRH;
  const showPCM = isAdmin || isGestor || isManutencao;

  const showEmbarcados =
    isAdmin ||
    isGestor ||
    isManutencao ||
    isCCO ||
    isTratativa ||
    isEmbarcados ||
    links.embarcados.tabs.some((t) => canSee(user, t.path));

  const showEstruturaFisica =
    (isAdmin || isGestor) &&
    links.estruturaFisica.tabs.some((t) => canSee(user, t.path));

  const showTratativas = links.tratativas.some((l) => {
    if (l.onlyAdminGestor && !(isAdmin || isGestor || isRH)) return null;
    if (l.onlyAdminGestorRH && !(isAdmin || isGestor || isRH)) return null;
    return canSee(user, l.path);
  });

  const showAvarias = links.avarias.some((l) => {
    if (l.path === "/avarias-resumo" && !(isAdmin || isGestor || isRH)) return null;
    return canSee(user, l.path);
  });

  const showChecklists = (isAdmin || isGestor) && canSee(user, "/checklists");
  const showSOS = links.sos.some((l) => canSee(user, l.path));
  const showConfig = isAdmin;

  return (
    <aside className="w-72 bg-blue-700 text-white flex flex-col">
      <div className="p-4 border-b border-blue-600 flex flex-col items-center">
        <img src={logoInova} alt="Logo InovaQuatai" className="h-10 w-auto mb-3" />
        {user && (
          <div className="text-center w-full">
            <p className="text-sm font-semibold text-white">Olá, {user.nome?.split(" ")[0]} 👋</p>
            <p className="text-xs text-blue-200">Seja bem-vindo!</p>

            {podeVerFarol && (
              <button
                onClick={abrirFarol}
                className="mt-3 w-full inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg px-3 py-2 text-sm font-semibold shadow-sm transition"
                type="button"
                title="Abrir Farol Tático"
              >
                Ir para Farol Tático
                <ExternalLink className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>

      <nav className="flex-1 p-3 overflow-y-auto">
        {showInicioExecutivo && canSee(user, links.inicioExecutivo.path) && (
          <NavLink to={links.inicioExecutivo.path} className={navLinkClass}>
            {links.inicioExecutivo.icon}
            <span className="whitespace-nowrap">{links.inicioExecutivo.label}</span>
          </NavLink>
        )}

        {showInicioBasico && canSee(user, links.inicioBasico.path) && (
          <NavLink to={links.inicioBasico.path} className={navLinkClass}>
            {links.inicioBasico.icon}
            <span className="whitespace-nowrap">{links.inicioBasico.label}</span>
          </NavLink>
        )}

        {showPCM && (
          <>
            <button
              onClick={() => setPcmOpen(!pcmOpen)}
              className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg mb-2 hover:bg-blue-600"
              type="button"
            >
              <div className="flex items-center gap-3 min-w-0">
                {links.pcm.icon}
                <span className="whitespace-nowrap truncate">{links.pcm.label}</span>
              </div>
              {pcmOpen ? <FaChevronDown size={14} /> : <FaChevronRight size={14} />}
            </button>

            {pcmOpen && (
              <div className="pl-4 border-l-2 border-blue-500 ml-3 mb-2">
                {links.pcm.tabs.map((t) =>
                  canSee(user, t.path) ? (
                    <NavLink key={t.path} to={t.path} className={subNavLinkClass}>
                      {t.icon}
                      <span className="whitespace-nowrap">{t.label}</span>
                    </NavLink>
                  ) : null
                )}
              </div>
            )}
          </>
        )}

        {showEmbarcados && (
          <>
            <button
              onClick={() => setEmbarcadosOpen(!embarcadosOpen)}
              className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg mb-2 hover:bg-blue-600"
              type="button"
            >
              <div className="flex items-center gap-3 min-w-0">
                {links.embarcados.icon}
                <span className="whitespace-nowrap truncate">{links.embarcados.label}</span>
              </div>
              {embarcadosOpen ? <FaChevronDown size={14} /> : <FaChevronRight size={14} />}
            </button>

            {embarcadosOpen && (
              <div className="pl-4 border-l-2 border-blue-500 ml-3 mb-2">
                {links.embarcados.tabs.map((t) =>
                  canSee(user, t.path) ? (
                    <NavLink key={t.path} to={t.path} className={subNavLinkClass}>
                      {t.icon}
                      <span className="whitespace-nowrap">{t.label}</span>
                    </NavLink>
                  ) : null
                )}
              </div>
            )}
          </>
        )}

        {showDesempenhoDiesel && (
          <>
            <button
              onClick={() => setDesempenhoDieselOpen(!desempenhoDieselOpen)}
              className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg mb-2 hover:bg-blue-600"
              type="button"
            >
              <div className="flex items-center gap-3 min-w-0">
                {links.desempenhoDiesel.icon}
                <span className="whitespace-nowrap truncate">{links.desempenhoDiesel.label}</span>
              </div>
              {desempenhoDieselOpen ? <FaChevronDown size={14} /> : <FaChevronRight size={14} />}
            </button>

            {desempenhoDieselOpen && (
              <div className="pl-4 border-l-2 border-blue-500 ml-3 mb-2">
                {links.desempenhoDiesel.tabs.map((t) =>
                  canSee(user, t.path) ? (
                    <NavLink key={t.path} to={t.path} className={subNavLinkClass}>
                      {t.icon}
                      <span className="whitespace-nowrap">{t.label}</span>
                    </NavLink>
                  ) : null
                )}
              </div>
            )}
          </>
        )}

        {showEstruturaFisica && (
          <>
            <button
              onClick={() => setEstruturaFisicaOpen(!estruturaFisicaOpen)}
              className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg mb-2 hover:bg-blue-600"
              type="button"
            >
              <div className="flex items-center gap-3 min-w-0">
                {links.estruturaFisica.icon}
                <span className="whitespace-nowrap truncate">{links.estruturaFisica.label}</span>
              </div>
              {estruturaFisicaOpen ? <FaChevronDown size={14} /> : <FaChevronRight size={14} />}
            </button>

            {estruturaFisicaOpen && (
              <div className="pl-4 border-l-2 border-blue-500 ml-3 mb-2">
                {links.estruturaFisica.tabs.map((t) =>
                  canSee(user, t.path) ? (
                    <NavLink key={t.path} to={t.path} className={subNavLinkClass}>
                      {t.icon}
                      <span className="whitespace-nowrap">{t.label}</span>
                    </NavLink>
                  ) : null
                )}
              </div>
            )}
          </>
        )}

        {showTratativas && (
          <>
            <button
              onClick={() => setTratativasOpen(!tratativasOpen)}
              className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg mb-2 hover:bg-blue-600"
              type="button"
            >
              <div className="flex items-center gap-3">
                <FaClipboardList /> <span>Tratativas</span>
              </div>
              {tratativasOpen ? <FaChevronDown size={14} /> : <FaChevronRight size={14} />}
            </button>

            {tratativasOpen && (
              <div className="pl-4 border-l-2 border-blue-500 ml-4 mb-2">
                {links.tratativas.map((link) => {
                  if (link.onlyAdminGestor && !(isAdmin || isGestor || isRH)) return null;
                  if (link.onlyAdminGestorRH && !(isAdmin || isGestor || isRH)) return null;
                  if (!link.onlyAdminGestor && !link.onlyAdminGestorRH && !canSee(user, link.path)) return null;
                  if (user?.nivel === "RH" && !canSee(user, link.path)) return null;

                  return (
                    <NavLink key={link.path} to={link.path} className={subNavLinkClass}>
                      {link.icon} <span>{link.label}</span>
                    </NavLink>
                  );
                })}
              </div>
            )}
          </>
        )}

        {showAvarias && (
          <>
            <button
              onClick={() => setAvariasOpen(!avariasOpen)}
              className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg mb-2 hover:bg-blue-600"
              type="button"
            >
              <div className="flex items-center gap-3">
                <FaTools /> <span>Avarias</span>
              </div>
              {avariasOpen ? <FaChevronDown size={14} /> : <FaChevronRight size={14} />}
            </button>

            {avariasOpen && (
              <div className="pl-4 border-l-2 border-blue-500 ml-3 mb-2">
                {links.avarias.map((link) => {
                  if (link.path === "/avarias-resumo" && !(isAdmin || isGestor || isRH)) return null;

                  return canSee(user, link.path) ||
                    (link.path === "/avarias-resumo" && (isAdmin || isGestor || isRH)) ? (
                    <NavLink key={link.path} to={link.path} className={subNavLinkClass}>
                      {link.icon} <span>{link.label}</span>
                    </NavLink>
                  ) : null;
                })}
              </div>
            )}
          </>
        )}

        {showChecklists && (
          <>
            <button
              onClick={() => setChecklistsOpen(!checklistsOpen)}
              className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg mb-2 hover:bg-blue-600"
              type="button"
            >
              <div className="flex items-center gap-3">
                <FaClipboardCheck /> <span>Checklists</span>
              </div>
              {checklistsOpen ? <FaChevronDown size={14} /> : <FaChevronRight size={14} />}
            </button>

            {checklistsOpen && (
              <div className="pl-4 border-l-2 border-blue-500 ml-3 mb-2">
                {links.checklists.map((link) =>
                  canSee(user, link.path) ? (
                    <NavLink key={link.path} to={link.path} className={subNavLinkClass}>
                      {link.icon} <span>{link.label}</span>
                    </NavLink>
                  ) : null
                )}
              </div>
            )}
          </>
        )}

        {showSOS && (
          <>
            <button
              onClick={() => setIntervencoesOpen(!intervencoesOpen)}
              className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg mb-2 hover:bg-blue-600"
              type="button"
            >
              <div className="flex items-center gap-3">
                <FaCogs /> <span>Intervenções</span>
              </div>
              {intervencoesOpen ? <FaChevronDown size={14} /> : <FaChevronRight size={14} />}
            </button>

            {intervencoesOpen && (
              <div className="pl-4 border-l-2 border-blue-500 ml-3 mb-2">
                {links.sos.map((link) =>
                  canSee(user, link.path) ? (
                    <NavLink key={link.path} to={link.path} className={subNavLinkClass}>
                      {link.icon} <span>{link.label}</span>
                    </NavLink>
                  ) : null
                )}
              </div>
            )}
          </>
        )}

        {showConfig && (
          <>
            <hr className="my-3 border-blue-500" />
            <button
              onClick={() => setConfigOpen(!configOpen)}
              className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg mb-2 hover:bg-blue-600"
              type="button"
            >
              <div className="flex items-center gap-3">
                <FaUserCog /> <span>Configurações</span>
              </div>
              {configOpen ? <FaChevronDown size={14} /> : <FaChevronRight size={14} />}
            </button>

            {configOpen && (
              <div className="pl-4 border-l-2 border-blue-500 ml-3 mb-2">
                <NavLink to="/usuarios" className={subNavLinkClass}>
                  <FaUserCog /> <span>Usuários</span>
                </NavLink>
              </div>
            )}
          </>
        )}
      </nav>

      <div className="p-3 border-t border-blue-600">
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 rounded-md text-sm"
          type="button"
        >
          <FaSignOutAlt /> <span>Sair</span>
        </button>
      </div>

      <div className="p-3 text-xs text-center border-t border-blue-600 text-blue-200">
        © {new Date().getFullYear()} InovaQuatai
      </div>
    </aside>
  );
}
