import { Routes, Route, Navigate, useParams } from "react-router-dom";
import { lazy, Suspense, useContext, useEffect } from "react";
import { Capacitor } from "@capacitor/core";

import { AuthProvider } from "./context/AuthContext";
import { AccessProvider } from "./context/AccessContext";
import { useAccessGovernance } from "./context/AccessContext";
import { AuthContext } from "./context/AuthContext";

import Layout from "./components/Layout";
import RequireAuth from "./routes/RequireAuth";
import InstallAppPrompt from "./components/InstallAppPrompt";
import BotJobNotifier from "./components/BotJobNotifier";
import AcidentesAlertaModal from "./components/AcidentesAlertaModal";
import UpdateAppPrompt from "./components/UpdateAppPrompt";

import { getDefaultAccessiblePath } from "./utils/access";

// Login + Dashboard ficam eager (pagina inicial). O resto faz lazy
// para o usuario nao precisar baixar 4 MB de JS antes de abrir uma
// pagina simples. Cada pagina carrega seu chunk so quando navegada.
import Login from "./pages/auth/Login";
const AtualizarSenha = lazy(() => import("./pages/auth/AtualizarSenha"));
const AtualizarPerfil = lazy(() => import("./pages/auth/AtualizarPerfil"));

import Dashboard from "./pages/home/Dashboard";
import InicioRapido from "./pages/home/InicioRapido";
import MobileHome from "./pages/home/MobileHome";
import { MobileTabBadgesProvider } from "./context/MobileTabBadgesContext";

const CentralTratativas = lazy(() => import("./pages/tratativas/CentralTratativas"));
const TratativasResumo = lazy(() => import("./pages/tratativas/TratativasResumo"));
const TratarTratativa = lazy(() => import("./pages/tratativas/TratarTratativa"));
const ConsultarTratativa = lazy(() => import("./pages/tratativas/ConsultarTratativa"));
const SolicitacaoTratativa = lazy(() => import("./pages/tratativas/SolicitacaoTratativa"));
const TratativasRH = lazy(() => import("./pages/tratativas/TratativasRH"));

const LancarAvaria = lazy(() => import("./pages/avarias/LancarAvaria"));
const CobrancasAvarias = lazy(() => import("./pages/avarias/CobrancasAvarias"));
const AprovacaoAvarias = lazy(() => import("./pages/avarias/AprovacaoAvarias"));
const AvariasEmRevisao = lazy(() => import("./pages/avarias/AvariasEmRevisao"));
const AvariasResumo = lazy(() => import("./pages/avarias/AvariasResumo"));
const AcidentesLancamento = lazy(() => import("./pages/acidentes/AcidentesLancamento"));
const AcidentesImagens = lazy(() => import("./pages/acidentes/AcidentesImagens"));
const AcidentesCentral = lazy(() => import("./pages/acidentes/AcidentesCentral"));
const SacLancamento = lazy(() => import("./pages/sac/SacLancamento"));
const SacCentral = lazy(() => import("./pages/sac/SacCentral"));
const SacResumo = lazy(() => import("./pages/sac/SacResumo"));

const SolicitacaoSOS = lazy(() => import("./pages/intervencoes/SolicitacaoSOS"));
const SOSFechamento = lazy(() => import("./pages/intervencoes/SOSFechamento"));
const SOSTratamento = lazy(() => import("./pages/intervencoes/SOSTratamento"));
const SOSCentral = lazy(() => import("./pages/intervencoes/SOSCentral"));
const SOSDashboard = lazy(() => import("./pages/intervencoes/SOSDashboard"));
const SOS_Resumo = lazy(() => import("./pages/intervencoes/SOS_Resumo"));
const KMRodado = lazy(() => import("./pages/intervencoes/KMRodado"));

const PCMInicio = lazy(() => import("./pages/pcm/PCMInicio"));
const PCMDiario = lazy(() => import("./pages/pcm/PCMDiario"));
const PCMResumo = lazy(() => import("./pages/pcm/PCMResumo"));
const PCM_Preventivas = lazy(() => import("./pages/pcm/PCM_Preventivas"));
const PCMTrocaPneus = lazy(() => import("./pages/pcm/PCMTrocaPneus"));
const PCMControleFichas = lazy(() => import("./pages/pcm/PCMControleFichas"));

const Usuarios = lazy(() => import("./pages/configuracoes/Usuarios"));
const NiveisAcesso = lazy(() => import("./pages/configuracoes/NiveisAcesso"));
const Funcionarios = lazy(() => import("./pages/pessoas/Funcionarios"));
const Ferias = lazy(() => import("./pages/pessoas/Ferias"));
const OrganogramaCanvas = lazy(() => import("./pages/pessoas/OrganogramaCanvas"));
const VagasCentral = lazy(() => import("./pages/pessoas/VagasCentral"));

const DesempenhoLancamento = lazy(() => import("./pages/desempenho-diesel/DesempenhoLancamento"));
const DesempenhoDieselResumo = lazy(() => import("./pages/desempenho-diesel/DesempenhoDieselResumo"));
const DesempenhoDieselAcompanhamento = lazy(() => import("./pages/desempenho-diesel/DesempenhoDieselAcompanhamento"));
const DesempenhoDieselTratativas = lazy(() => import("./pages/desempenho-diesel/DesempenhoDieselTratativas"));
const DesempenhoDieselAgente = lazy(() => import("./pages/desempenho-diesel/DesempenhoDieselAgente"));
const DesempenhoDieselCheckpoint = lazy(() => import("./pages/desempenho-diesel/DesempenhoDieselCheckpoint"));
const Desempenho_Diesel_Tratativas_Central = lazy(() => import("./pages/desempenho-diesel/Desempenho_Diesel_Tratativas_Central"));
const DieselTratarTratativa = lazy(() => import("./pages/desempenho-diesel/DieselTratarTratativa"));
const DieselConsultarTratativa = lazy(() => import("./pages/desempenho-diesel/DieselConsultarTratativa"));

const EstoqueDieselResumo = lazy(() => import("./pages/estoque-diesel/EstoqueDieselResumo"));
const EstoqueDieselOperacao = lazy(() => import("./pages/estoque-diesel/EstoqueDieselOperacao"));
const EstoqueDieselPlanejamentoControle = lazy(() => import("./pages/estoque-diesel/EstoqueDieselPlanejamentoControle"));
const EstoqueDieselParametros = lazy(() => import("./pages/estoque-diesel/EstoqueDieselParametros"));
const EstoqueDieselRecebimento = lazy(() => import("./pages/estoque-diesel/EstoqueDieselRecebimento"));

const ChecklistCentral = lazy(() => import("./pages/checklists/ChecklistCentral"));

const EmbarcadosCentral = lazy(() => import("./pages/embarcados/EmbarcadosCentral"));
const EmbarcadosMovimentacoes = lazy(() => import("./pages/embarcados/EmbarcadosMovimentacoes"));
const EmbarcadosReparos = lazy(() => import("./pages/embarcados/EmbarcadosReparos"));
const EmbarcadosEnvioManutencao = lazy(() => import("./pages/embarcados/EmbarcadosEnvioManutencao"));
const ReparoSolicitacaoDetalhes = lazy(() => import("./components/embarcados/ReparoSolicitacaoDetalhes"));
const ReparoSolicitacaoExecucao = lazy(() => import("./components/embarcados/ReparoSolicitacaoExecucao"));

const EstruturaFisicaSolicitacao = lazy(() => import("./pages/estrutura-fisica/EstruturaFisicaSolicitacao"));
const EstruturaFisicaCentral = lazy(() => import("./pages/estrutura-fisica/EstruturaFisicaCentral"));
const EstruturaFisicaConsultar = lazy(() => import("./pages/estrutura-fisica/EstruturaFisicaConsultar"));
const EstruturaFisicaTratar = lazy(() => import("./pages/estrutura-fisica/EstruturaFisicaTratar"));
const SuprimentosResumo = lazy(() => import("./pages/suprimentos/SuprimentosResumo"));
const SuprimentosGarantias = lazy(() => import("./pages/suprimentos/SuprimentosGarantias"));
const SuprimentosTestes = lazy(() => import("./pages/suprimentos/SuprimentosTestes"));
const SuprimentosServicoExterno = lazy(() => import("./pages/suprimentos/SuprimentosServicoExterno"));
const SuprimentosCadastro = lazy(() => import("./pages/suprimentos/SuprimentosCadastro"));
const SuprimentosContagem = lazy(() => import("./pages/suprimentos/SuprimentosContagem"));
const SuprimentosContagemDia = lazy(() => import("./pages/suprimentos/SuprimentosContagemDia"));
const SuprimentosContagemSemanal = lazy(() => import("./pages/suprimentos/SuprimentosContagemSemanal"));

function HomeDecider() {
  const { user } = useContext(AuthContext);
  const { profileMap } = useAccessGovernance();
  const isNativeShell = Capacitor.isNativePlatform();

  if (isNativeShell) {
    return <MobileHome />;
  }

  const destination = getDefaultAccessiblePath(user, profileMap);

  if (destination === "/painel") {
    return <Dashboard />;
  }

  if (destination === "/inicio-rapido") {
    return <InicioRapido />;
  }

  return <Navigate to={destination} replace />;
}

function EstoqueDieselProgramacaoRedirect() {
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  return <Navigate to={`/estoque-diesel/programacao/2026/${month}`} replace />;
}

function isValidUuidParam(value) {
  if (!value) return false;
  const s = String(value).trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    s
  );
}

function DieselTratarRouteGuard() {
  const { id } = useParams();
  if (!isValidUuidParam(id)) {
    return <Navigate to="/diesel-tratativas" replace />;
  }
  return <DieselTratarTratativa />;
}

function DieselConsultarRouteGuard() {
  const { id } = useParams();
  if (!isValidUuidParam(id)) {
    return <Navigate to="/diesel-tratativas" replace />;
  }
  return <DieselConsultarTratativa />;
}

export default function App() {
  useEffect(() => {
    window.__INOVE_SET_BOOT_STAGE?.(
      "Sessao iniciada",
      "Preparando suas rotas e o shell do aplicativo."
    );
    window.__INOVE_HIDE_BOOT?.();
  }, []);

  return (
    <AuthProvider>
      <AccessProvider>
        <MobileTabBadgesProvider>
        <>
          <Suspense
            fallback={
              <div className="fixed inset-0 z-[50] flex items-center justify-center bg-slate-50/80 backdrop-blur-sm">
                <div className="rounded-2xl border border-slate-200 bg-white px-6 py-4 shadow-lg">
                  <div className="text-sm font-bold text-slate-700">Carregando pagina...</div>
                </div>
              </div>
            }
          >
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/atualizar-senha" element={<AtualizarSenha />} />

            <Route
              element={
                <RequireAuth>
                  <Layout />
                </RequireAuth>
              }
            >
              <Route path="/atualizar-perfil" element={<AtualizarPerfil />} />

              <Route path="/" element={<HomeDecider />} />
              <Route path="/inove" element={<HomeDecider />} />
              <Route path="/painel" element={<Dashboard />} />
              <Route path="/portal" element={<Navigate to="/inove" replace />} />
              <Route path="/inicio-rapido" element={<InicioRapido />} />

              {/* Desempenho Diesel */}
              <Route path="/desempenho-lancamento" element={<DesempenhoLancamento />} />
              <Route path="/desempenho-diesel-resumo" element={<DesempenhoDieselResumo />} />
              <Route
                path="/desempenho-diesel-acompanhamento"
                element={<DesempenhoDieselAcompanhamento />}
              />
              <Route
                path="/desempenho-diesel-tratativas"
                element={<Navigate to="/diesel-tratativas" replace />}
              />
              <Route path="/desempenho-diesel-agente" element={<DesempenhoDieselAgente />} />
              <Route
                path="/desempenho-diesel-checkpoint/:id"
                element={<DesempenhoDieselCheckpoint />}
              />
              <Route
                path="/desempenho-diesel"
                element={<Navigate to="/desempenho-diesel-resumo" replace />}
              />

              <Route path="/diesel-tratativas" element={<Desempenho_Diesel_Tratativas_Central />} />
              <Route path="/diesel-tratar/:id" element={<DieselTratarRouteGuard />} />
              <Route path="/diesel-consultar/:id" element={<DieselConsultarRouteGuard />} />
              <Route path="/diesel/tratativas" element={<Navigate to="/diesel-tratativas" replace />} />
              <Route path="/diesel/tratar/:id" element={<DieselTratarRouteGuard />} />
              <Route path="/diesel/consultar/:id" element={<DieselConsultarRouteGuard />} />

              {/* Estoque Diesel */}
              <Route path="/estoque-diesel/resumo" element={<EstoqueDieselResumo />} />
              <Route
                path="/estoque-diesel/operacao"
                element={<Navigate to="/estoque-diesel/operacao/2026/01" replace />}
              />
              <Route path="/estoque-diesel/operacao/:ano/:mes" element={<EstoqueDieselOperacao />} />
              <Route
                path="/estoque-diesel/planejamento-controle"
                element={<EstoqueDieselPlanejamentoControle />}
              />
              <Route
                path="/estoque-diesel/programacao"
                element={<EstoqueDieselProgramacaoRedirect />}
              />
              <Route
                path="/estoque-diesel/programacao/:ano/:mes"
                element={<EstoqueDieselPlanejamentoControle />}
              />
              <Route path="/estoque-diesel/parametros" element={<EstoqueDieselParametros />} />
              <Route path="/estoque-diesel/recebimento" element={<EstoqueDieselRecebimento />} />
              <Route path="/estoque-diesel" element={<Navigate to="/estoque-diesel/resumo" replace />} />

              {/* PCM */}
              <Route path="/pcm-inicio" element={<PCMInicio />} />
              <Route path="/pcm-resumo" element={<PCMResumo />} />
              <Route path="/pcm-diario/:id" element={<PCMDiario />} />
              <Route path="/pcm-preventivas" element={<PCM_Preventivas />} />
              <Route path="/pcm-troca-pneus" element={<PCMTrocaPneus />} />
              <Route path="/pcm-controle-fichas" element={<PCMControleFichas />} />

              {/* Checklists */}
              <Route path="/checklists" element={<ChecklistCentral />} />

              {/* Embarcados */}
              <Route path="/embarcados-central" element={<EmbarcadosCentral />} />
              <Route path="/embarcados-movimentacoes" element={<EmbarcadosMovimentacoes />} />
              <Route path="/embarcados-reparos" element={<EmbarcadosReparos />} />
              <Route path="/embarcados-reparos/:id" element={<ReparoSolicitacaoDetalhes />} />
              <Route
                path="/embarcados-reparos/:id/executar"
                element={<ReparoSolicitacaoExecucao />}
              />
              <Route path="/embarcados-envio-manutencao" element={<EmbarcadosEnvioManutencao />} />
              <Route path="/embarcados" element={<Navigate to="/embarcados-central" replace />} />

              {/* Tratativas */}
              <Route path="/central" element={<CentralTratativas />} />
              <Route path="/tratativas-resumo" element={<TratativasResumo />} />
              <Route path="/tratar/:id" element={<TratarTratativa />} />
              <Route path="/consultar/:id" element={<ConsultarTratativa />} />
              <Route path="/solicitar" element={<SolicitacaoTratativa />} />
              <Route path="/tratativas-rh" element={<TratativasRH />} />

              {/* Estrutura Física */}
              <Route
                path="/estrutura-fisica/solicitacao"
                element={<EstruturaFisicaSolicitacao />}
              />
              <Route path="/estrutura-fisica/central" element={<EstruturaFisicaCentral />} />
              <Route
                path="/estrutura-fisica/consultar/:id"
                element={<EstruturaFisicaConsultar />}
              />
              <Route path="/estrutura-fisica/tratar/:id" element={<EstruturaFisicaTratar />} />
              <Route
                path="/estrutura-fisica"
                element={<Navigate to="/estrutura-fisica/central" replace />}
              />

              {/* Suprimentos */}
              <Route path="/suprimentos/resumo" element={<SuprimentosResumo />} />
              <Route path="/suprimentos/garantias" element={<SuprimentosGarantias />} />
              <Route path="/suprimentos/testes" element={<SuprimentosTestes />} />
              <Route path="/suprimentos/servico-externo" element={<SuprimentosServicoExterno />} />
              <Route path="/suprimentos/cadastro" element={<SuprimentosCadastro />} />
              <Route path="/suprimentos/contagem" element={<SuprimentosContagem />} />
              <Route path="/suprimentos/contagem/dia/:data" element={<SuprimentosContagemDia />} />
              <Route path="/suprimentos/contagem/lote/:loteId" element={<SuprimentosContagemDia />} />
              <Route path="/suprimentos/contagem/semanal/:id" element={<SuprimentosContagemSemanal />} />
              <Route path="/suprimentos" element={<Navigate to="/suprimentos/resumo" replace />} />

              {/* Avarias */}
              <Route path="/lancar-avaria" element={<LancarAvaria />} />
              <Route path="/aprovar-avarias" element={<AprovacaoAvarias />} />
              <Route path="/cobrancas" element={<CobrancasAvarias />} />
              <Route path="/avarias-resumo" element={<AvariasResumo />} />
              <Route path="/avarias-em-revisao" element={<AvariasEmRevisao />} />

              {/* Acidentes */}
              <Route path="/acidentes/lancamento" element={<AcidentesLancamento />} />
              <Route path="/acidentes/imagens" element={<AcidentesImagens />} />
              <Route path="/acidentes/central" element={<AcidentesCentral />} />
              <Route path="/acidentes" element={<Navigate to="/acidentes/central" replace />} />

              {/* SAC */}
              <Route path="/sac/lancamento" element={<SacLancamento />} />
              <Route path="/sac/central" element={<SacCentral />} />
              <Route path="/sac/resumo" element={<SacResumo />} />
              <Route path="/sac" element={<Navigate to="/sac/central" replace />} />

              {/* Intervenções / SOS */}
              <Route path="/sos-solicitacao" element={<SolicitacaoSOS />} />
              <Route path="/sos-fechamento" element={<SOSFechamento />} />
              <Route path="/sos-tratamento" element={<SOSTratamento />} />
              <Route path="/sos-central" element={<SOSCentral />} />
              <Route path="/sos-dashboard" element={<SOSDashboard />} />
              <Route path="/sos-resumo" element={<SOS_Resumo />} />
              <Route path="/km-rodado" element={<KMRodado />} />

              {/* Configurações */}
              <Route path="/usuarios" element={<Usuarios />} />
              <Route path="/funcionarios" element={<Funcionarios />} />
              <Route path="/ferias" element={<Ferias />} />
              <Route path="/organograma" element={<OrganogramaCanvas />} />
              <Route path="/vagas" element={<VagasCentral />} />
              <Route path="/organograma-canvas" element={<Navigate to="/organograma" replace />} />
              <Route path="/organograma-manutencao" element={<Navigate to="/organograma" replace />} />
              <Route path="/niveis-acesso" element={<NiveisAcesso />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </Suspense>

          <InstallAppPrompt />
          <UpdateAppPrompt />
          <BotJobNotifier />
          <AcidentesAlertaModal />
        </>
        </MobileTabBadgesProvider>
      </AccessProvider>
    </AuthProvider>
  );
}
