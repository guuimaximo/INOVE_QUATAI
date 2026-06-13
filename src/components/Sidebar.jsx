import { useState, useContext, useMemo, useEffect } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  FaHome,
  FaClipboardList,
  FaTools,
  FaMoneyBill,
  FaChevronDown,
  FaChevronRight,
  FaPenSquare,
  FaListAlt,
  FaFileInvoice,
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
  FaBuilding,
  FaIdBadge,
  FaShieldAlt,
  FaHdd,
  FaUsers,
  FaWarehouse,
  FaCalendarAlt,
  FaCamera,
  FaSitemap,
  FaBriefcase,
  FaBoxes,
  FaFlask,
  FaExclamationTriangle,
  FaTruck,
  FaBusAlt,
  FaPlus,
} from "react-icons/fa";
import { ExternalLink } from "lucide-react";
import logoInova from "../assets/logoInovaQuatai.png";
import { AuthContext } from "../context/AuthContext";
import { useAccessGovernance } from "../context/AccessContext";
import { useAcidentesPendentes } from "../hooks/useAcidentesPendentes";
import { canUserAccessPath, canUserSeeFarol } from "../utils/access";

/* =========================
   ROTAS
========================= */

const DIESEL_ROUTES = {
  lancamento: "/desempenho-lancamento",
  resumo: "/desempenho-diesel-resumo",
  acompanhamento: "/desempenho-diesel-acompanhamento",
  agente: "/desempenho-diesel-agente",
};

const DIESEL_TRATATIVAS_ROUTES = {
  central: "/diesel-tratativas",
};

const ESTOQUE_DIESEL_ROUTES = {
  resumo: "/estoque-diesel/resumo",
  operacao: "/estoque-diesel/operacao/2026/01",
  programacao: "/estoque-diesel/programacao",
  parametros: "/estoque-diesel/parametros",
};

const PCM_ROUTES = {
  resumo: "/pcm-resumo",
  inicio: "/pcm-inicio",
  diario: "/pcm-diario",
  preventivas: "/pcm-preventivas",
  trocaPneus: "/pcm-troca-pneus",
  controleFichas: "/pcm-controle-fichas",
};

const EMBARCADOS_ROUTES = {
  central: "/embarcados-central",
  movimentacoes: "/embarcados-movimentacoes",
  reparos: "/embarcados-reparos",
  envioManutencao: "/embarcados-envio-manutencao",
};

const ESTRUTURA_FISICA_ROUTES = {
  solicitacao: "/estrutura-fisica/solicitacao",
  central: "/estrutura-fisica/central",
  consultar: "/estrutura-fisica/consultar/:id",
  tratar: "/estrutura-fisica/tratar/:id",
};

const FAROL_URL = "https://faroldemetas.onrender.com/?from=inove";

export default function Sidebar() {
  const location = useLocation();
  const [pcmOpen, setPcmOpen] = useState(false);
  const [desempenhoDieselOpen, setDesempenhoDieselOpen] = useState(false);
  const [estoqueDieselOpen, setEstoqueDieselOpen] = useState(false);
  const [tratativasOpen, setTratativasOpen] = useState(false);
  const [sacOpen, setSacOpen] = useState(false);
  const [especialOpen, setEspecialOpen] = useState(false);
  const [avariasOpen, setAvariasOpen] = useState(false);
  const [acidentesOpen, setAcidentesOpen] = useState(false);
  const [checklistsOpen, setChecklistsOpen] = useState(false);
  const [intervencoesOpen, setIntervencoesOpen] = useState(false);
  const [embarcadosOpen, setEmbarcadosOpen] = useState(false);
  const [estruturaFisicaOpen, setEstruturaFisicaOpen] = useState(false);
  const [suprimentosOpen, setSuprimentosOpen] = useState(false);
  const [pessoasOpen, setPessoasOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);

  const { user, logout } = useContext(AuthContext);
  const { profileMap } = useAccessGovernance();
  const navigate = useNavigate();
  const { count: acidentesPendentes } = useAcidentesPendentes();

  const canSee = useMemo(
    () => (path) => canUserAccessPath(user, path, profileMap),
    [profileMap, user]
  );
  const showInicioExecutivo = canSee("/painel");
  const showInicioBasico = !showInicioExecutivo;
  const podeVerFarol = useMemo(() => canUserSeeFarol(user, profileMap), [profileMap, user]);

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
    // Troca pra aba do Farol no Layout (mantém a sessão do Inove).
    // O Layout escuta este evento e seta farolTab = "farol".
    window.dispatchEvent(new CustomEvent("inove:switch-to-farol"));
  }

  const links = useMemo(
    () => ({
      inicioExecutivo: { path: "/", label: "Início", icon: <FaHome /> },
      inicioBasico: { path: "/inicio-rapido", label: "Início", icon: <FaHome /> },
      pessoas: {
        label: "Pessoas",
        icon: <FaUsers />,
        tabs: [
          { path: "/funcionarios", label: "Funcionários", icon: <FaIdBadge /> },
          { path: "/ferias", label: "Ferias", icon: <FaCalendarAlt /> },
          { path: "/organograma", label: "Organograma", icon: <FaSitemap /> },
          { path: "/vagas", label: "Vagas", icon: <FaBriefcase /> },
        ],
      },

      pcm: {
        label: "PCM",
        icon: <FaClipboardList />,
        tabs: [
          { path: PCM_ROUTES.resumo, label: "Resumo", icon: <FaChartPie /> },
          { path: PCM_ROUTES.inicio, label: "PCM do dia", icon: <FaPenSquare /> },
          { path: PCM_ROUTES.preventivas, label: "Preventivas", icon: <FaWrench /> },
          { path: PCM_ROUTES.trocaPneus, label: "Troca de pneus", icon: <FaTools /> },
          { path: PCM_ROUTES.controleFichas, label: "Controle de fichas", icon: <FaClipboardList /> },
          { path: "/pcm-controle-pneus", label: "Controle de pneus", icon: <FaTools /> },
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

      estoqueDiesel: {
        label: "Estoque de Diesel",
        icon: <FaWarehouse />,
        tabs: [
          { path: ESTOQUE_DIESEL_ROUTES.resumo, label: "Medição de Diesel", icon: <FaChartPie /> },
          { path: ESTOQUE_DIESEL_ROUTES.programacao, label: "Programação de Diesel", icon: <FaCalendarAlt /> },
          { path: ESTOQUE_DIESEL_ROUTES.parametros, label: "Parâmetros", icon: <FaTools /> },
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

      suprimentos: {
        label: "Suprimentos",
        icon: <FaBoxes />,
        tabs: [
          { path: "/suprimentos/cadastro", label: "Cadastro", icon: <FaBoxes /> },
          { path: "/suprimentos/garantias", label: "Garantias", icon: <FaShieldAlt /> },
          { path: "/suprimentos/testes", label: "Testes", icon: <FaFlask /> },
          { path: "/suprimentos/servico-externo", label: "Serviço Externo", icon: <FaTruck /> },
          { path: "/suprimentos/contagem", label: "Contagem", icon: <FaSearch /> },
        ],
      },

      tratativas: [
        { path: "/tratativas-resumo", label: "Resumo", icon: <FaChartPie /> },
        { path: "/solicitar", label: "Solicitação", icon: <FaPenSquare /> },
        { path: "/central", label: "Central", icon: <FaListAlt /> },
        { path: "/tratativas-rh", label: "Tratativas RH", icon: <FaUserCog /> },
      ],

      sac: [
        { path: "/sac/resumo", label: "Resumo", icon: <FaChartPie /> },
        { path: "/sac/lancamento", label: "Lançamento", icon: <FaPenSquare /> },
        { path: "/sac/central", label: "Central", icon: <FaListAlt /> },
      ],

      avarias: [
        { path: "/avarias-resumo", label: "Resumo", icon: <FaChartPie /> },
        { path: "/lancar-avaria", label: "Lançamento", icon: <FaWrench /> },
        { path: "/avarias-em-revisao", label: "Pendências de Revisão", icon: <FaUndo /> },
        { path: "/aprovar-avarias", label: "Aprovações", icon: <FaClipboardCheck /> },
        { path: "/cobrancas", label: "Cobranças", icon: <FaMoneyBill /> },
      ],

      acidentes: [
        { path: "/acidentes/lancamento", label: "Lançamento", icon: <FaPenSquare /> },
        { path: "/acidentes/imagens", label: "Imagens", icon: <FaCamera /> },
        { path: "/acidentes/central", label: "Central", icon: <FaListAlt /> },
      ],

      checklists: [
        { path: "/checklists", label: "Central", icon: <FaClipboardCheck /> },
        { path: "/checklists/painel-sr", label: "Painel SR", icon: <FaClipboardCheck /> },
        { path: "/checklists/fichas-sr-manutencao", label: "Fichas SR - Manutenção", icon: <FaClipboardCheck /> },
      ],

      sos: [
        { path: "/sos-resumo", label: "Resumo", icon: <FaChartPie /> },
        { path: "/sos-solicitacao", label: "Solicitação", icon: <FaPenSquare /> },
        { path: "/sos-fechamento", label: "Fechamento", icon: <FaCheckDouble /> },
        { path: "/sos-tratamento", label: "Manutenção", icon: <FaScrewdriver /> },
        { path: "/sos-central", label: "Central", icon: <FaEye /> },
        { path: "/sos-dashboard", label: "Dashboard (Excel)", icon: <FaDownload /> },
        { path: "/km-rodado", label: "KM Rodado (Dia)", icon: <FaRoad /> },
      ],

      configuracoes: [
        { path: "/usuarios", label: "Usuários", icon: <FaUserCog /> },
        { path: "/niveis-acesso", label: "Níveis de acesso", icon: <FaShieldAlt /> },
        { path: "/controle-dados", label: "Controle de Dados", icon: <FaHdd /> },
      ],
    }),
    []
  );

  const handleLogout = () => {
    if (confirm("Deseja realmente sair?")) {
      logout();
      navigate("/login");
    }
  };

  useEffect(() => {
    const path = location.pathname;
    if (path.startsWith("/pcm")) setPcmOpen(true);
    if (path.startsWith("/desempenho") || path.startsWith("/diesel")) setDesempenhoDieselOpen(true);
    if (path.startsWith("/estoque-diesel")) setEstoqueDieselOpen(true);
    if (path.startsWith("/tratativas") || path.startsWith("/central") || path.startsWith("/solicitar")) setTratativasOpen(true);
    if (path.startsWith("/sac")) setSacOpen(true);
    if (path.startsWith("/avarias") || path.startsWith("/lancar-avaria") || path.startsWith("/aprovar-avarias") || path.startsWith("/cobrancas")) setAvariasOpen(true);
    if (path.startsWith("/acidentes")) setAcidentesOpen(true);
    if (path.startsWith("/checklists")) setChecklistsOpen(true);
    if (path.startsWith("/sos") || path.startsWith("/km-rodado")) setIntervencoesOpen(true);
    if (path.startsWith("/embarcados")) setEmbarcadosOpen(true);
    if (path.startsWith("/estrutura-fisica")) setEstruturaFisicaOpen(true);
    if (path.startsWith("/suprimentos")) setSuprimentosOpen(true);
    if (path.startsWith("/funcionarios") || path.startsWith("/organograma")) setPessoasOpen(true);
    if (path.startsWith("/usuarios") || path.startsWith("/niveis-acesso") || path.startsWith("/controle-dados")) setConfigOpen(true);
  }, [location.pathname]);

  const navLinkClass = ({ isActive }) =>
    `mb-2 flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-all duration-200 ${
      isActive ? "bg-blue-500 shadow-sm" : "hover:bg-blue-600"
    }`;

  const subNavLinkClass = ({ isActive }) =>
    `mb-1 ml-4 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-200 ${
      isActive ? "bg-blue-500 shadow-sm" : "hover:bg-blue-600"
    }`;

  const showPCM = links.pcm.tabs.some((t) => canSee(t.path));
  const showEmbarcados = links.embarcados.tabs.some((t) => canSee(t.path));
  const showDesempenhoDiesel = links.desempenhoDiesel.tabs.some((t) => canSee(t.path));
  const showEstoqueDiesel = links.estoqueDiesel.tabs.some((t) => canSee(t.path));
  const showEstruturaFisica = links.estruturaFisica.tabs.some((t) => canSee(t.path));
  const showSuprimentos = links.suprimentos.tabs.some((t) => canSee(t.path));
  const showPessoas = links.pessoas.tabs.some((t) => canSee(t.path));
  const showTratativas = links.tratativas.some((l) => canSee(l.path));
  const showSac = links.sac.some((l) => canSee(l.path));
  const showAvarias = links.avarias.some((l) => canSee(l.path));
  const showAcidentes = links.acidentes.some((l) => canSee(l.path));
  const showChecklists = links.checklists.some((l) => canSee(l.path));
  const showSOS = links.sos.some((l) => canSee(l.path));
  const showConfig = links.configuracoes.some((l) => canSee(l.path));

  return (
    <aside className="flex h-full w-72 flex-col bg-blue-700 text-white shadow-2xl lg:shadow-none">
      <div className="flex flex-col items-center border-b border-blue-600 px-4 py-5">
        <img src={logoInova} alt="Logo InovaQuatai" className="h-10 w-auto mb-3" />
        {user && (
          <div className="text-center w-full">
            <p className="text-sm font-semibold text-white">Olá, {user.nome?.split(" ")[0]} 👋</p>
            <p className="mt-1 text-xs text-blue-200">Seu painel de operação</p>

            {podeVerFarol && (
              <button
                onClick={abrirFarol}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
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

      <nav className="flex-1 overflow-y-auto px-3 py-3 pb-24">
        {showInicioExecutivo && canSee(links.inicioExecutivo.path) && (
          <NavLink to={links.inicioExecutivo.path} className={navLinkClass}>
            {links.inicioExecutivo.icon}
            <span className="whitespace-nowrap">{links.inicioExecutivo.label}</span>
          </NavLink>
        )}

        {showInicioBasico && canSee(links.inicioBasico.path) && (
          <NavLink to={links.inicioBasico.path} className={navLinkClass}>
            {links.inicioBasico.icon}
            <span className="whitespace-nowrap">{links.inicioBasico.label}</span>
          </NavLink>
        )}

        {showPessoas && (
          <>
            <button
              onClick={() => setPessoasOpen(!pessoasOpen)}
              className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg mb-2 hover:bg-blue-600"
              type="button"
            >
              <div className="flex items-center gap-3 min-w-0">
                {links.pessoas.icon}
                <span className="whitespace-nowrap truncate">{links.pessoas.label}</span>
              </div>
              {pessoasOpen ? <FaChevronDown size={14} /> : <FaChevronRight size={14} />}
            </button>

            {pessoasOpen && (
              <div className="pl-4 border-l-2 border-blue-500 ml-3 mb-2">
                {links.pessoas.tabs.map((t) =>
                  canSee(t.path) ? (
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
                  canSee(t.path) ? (
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
                  canSee(t.path) ? (
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
                  canSee(t.path) ? (
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

        {showEstoqueDiesel && (
          <>
            <button
              onClick={() => setEstoqueDieselOpen(!estoqueDieselOpen)}
              className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg mb-2 hover:bg-blue-600"
              type="button"
            >
              <div className="flex items-center gap-3 min-w-0">
                {links.estoqueDiesel.icon}
                <span className="whitespace-nowrap truncate">{links.estoqueDiesel.label}</span>
              </div>
              {estoqueDieselOpen ? <FaChevronDown size={14} /> : <FaChevronRight size={14} />}
            </button>

            {estoqueDieselOpen && (
              <div className="pl-4 border-l-2 border-blue-500 ml-3 mb-2">
                {links.estoqueDiesel.tabs.map((t) =>
                  canSee(t.path) ? (
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
                  canSee(t.path) ? (
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

        {showSuprimentos && (
          <>
            <button
              onClick={() => setSuprimentosOpen(!suprimentosOpen)}
              className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg mb-2 hover:bg-blue-600"
              type="button"
            >
              <div className="flex items-center gap-3 min-w-0">
                {links.suprimentos.icon}
                <span className="whitespace-nowrap truncate">{links.suprimentos.label}</span>
              </div>
              {suprimentosOpen ? <FaChevronDown size={14} /> : <FaChevronRight size={14} />}
            </button>

            {suprimentosOpen && (
              <div className="pl-4 border-l-2 border-blue-500 ml-3 mb-2">
                {links.suprimentos.tabs.map((t) =>
                  canSee(t.path) ? (
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
                {links.tratativas.map((link) =>
                  canSee(link.path) ? (
                    <NavLink key={link.path} to={link.path} className={subNavLinkClass}>
                      {link.icon} <span>{link.label}</span>
                    </NavLink>
                  ) : null
                )}
              </div>
            )}
          </>
        )}

        {/* Controle de Especial */}
        {(canSee("/controle-especial/lancamento") || canSee("/controle-especial/central")) && (
          <>
            <button
              onClick={() => setEspecialOpen(!especialOpen)}
              className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg mb-2 hover:bg-blue-600"
              type="button"
            >
              <div className="flex items-center gap-3">
                <FaBusAlt /> <span>Controle de Especial</span>
              </div>
              {especialOpen ? <FaChevronDown size={14} /> : <FaChevronRight size={14} />}
            </button>
            {especialOpen && (
              <div className="pl-4 border-l-2 border-blue-500 ml-4 mb-2">
                {canSee("/controle-especial/lancamento") && (
                  <NavLink to="/controle-especial/lancamento" className={subNavLinkClass}>
                    <FaPlus /> <span>Lançamento</span>
                  </NavLink>
                )}
                {canSee("/controle-especial/central") && (
                  <NavLink to="/controle-especial/central" className={subNavLinkClass}>
                    <FaListAlt /> <span>Central</span>
                  </NavLink>
                )}
              </div>
            )}
          </>
        )}

        {showSac && (
          <>
            <button
              onClick={() => setSacOpen(!sacOpen)}
              className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg mb-2 hover:bg-blue-600"
              type="button"
            >
              <div className="flex items-center gap-3">
                <FaClipboardList /> <span>SAC</span>
              </div>
              {sacOpen ? <FaChevronDown size={14} /> : <FaChevronRight size={14} />}
            </button>

            {sacOpen && (
              <div className="pl-4 border-l-2 border-blue-500 ml-4 mb-2">
                {links.sac.map((link) =>
                  canSee(link.path) ? (
                    <NavLink key={link.path} to={link.path} className={subNavLinkClass}>
                      {link.icon} <span>{link.label}</span>
                    </NavLink>
                  ) : null
                )}
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
                {links.avarias.map((link) =>
                  canSee(link.path) ? (
                    <NavLink key={link.path} to={link.path} className={subNavLinkClass}>
                      {link.icon} <span>{link.label}</span>
                    </NavLink>
                  ) : null
                )}
              </div>
            )}
          </>
        )}

        {showAcidentes && (
          <>
            <button
              onClick={() => setAcidentesOpen(!acidentesOpen)}
              className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg mb-2 hover:bg-blue-600"
              type="button"
            >
              <div className="flex items-center gap-3">
                <FaExclamationTriangle /> <span>Acidentes</span>
                {acidentesPendentes > 0 ? (
                  <span className="inline-flex min-w-[20px] items-center justify-center rounded-full bg-rose-600 px-1.5 py-0.5 text-[10px] font-black leading-none text-white shadow">
                    {acidentesPendentes > 99 ? "99+" : acidentesPendentes}
                  </span>
                ) : null}
              </div>
              {acidentesOpen ? <FaChevronDown size={14} /> : <FaChevronRight size={14} />}
            </button>

            {acidentesOpen && (
              <div className="pl-4 border-l-2 border-blue-500 ml-3 mb-2">
                {links.acidentes.map((link) =>
                  canSee(link.path) ? (
                    <NavLink key={link.path} to={link.path} className={subNavLinkClass}>
                      {link.icon} <span>{link.label}</span>
                    </NavLink>
                  ) : null
                )}
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
                  canSee(link.path) ? (
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
                  canSee(link.path) ? (
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
                {links.configuracoes.map((link) => (
                  <NavLink key={link.path} to={link.path} className={subNavLinkClass}>
                    {link.icon} <span>{link.label}</span>
                  </NavLink>
                ))}
              </div>
            )}
          </>
        )}
      </nav>

      <div className="border-t border-blue-600 p-4">
        <button
          onClick={handleLogout}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold shadow-sm transition hover:bg-blue-500"
          type="button"
        >
          <FaSignOutAlt /> <span>Sair</span>
        </button>
      </div>

      <div className="border-t border-blue-600 px-3 py-3 text-center text-xs text-blue-200">
        INOVE {new Date().getFullYear()}
      </div>
    </aside>
  );
}
