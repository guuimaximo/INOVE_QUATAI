import { Routes, Route, Navigate, useParams } from "react-router-dom";
import { useContext, useEffect } from "react";
import { Capacitor } from "@capacitor/core";

import { AuthProvider } from "./context/AuthContext";
import { AccessProvider } from "./context/AccessContext";
import { useAccessGovernance } from "./context/AccessContext";
import { AuthContext } from "./context/AuthContext";

import Layout from "./components/Layout";
import RequireAuth from "./routes/RequireAuth";
import InstallAppPrompt from "./components/InstallAppPrompt";
import UpdateAppPrompt from "./components/UpdateAppPrompt";

import { getDefaultAccessiblePath } from "./utils/access";

import Login from "./pages/auth/Login";
import AtualizarSenha from "./pages/auth/AtualizarSenha";
import AtualizarPerfil from "./pages/auth/AtualizarPerfil";

import Dashboard from "./pages/home/Dashboard";
import InicioRapido from "./pages/home/InicioRapido";

import CentralTratativas from "./pages/tratativas/CentralTratativas";
import TratativasResumo from "./pages/tratativas/TratativasResumo";
import TratarTratativa from "./pages/tratativas/TratarTratativa";
import ConsultarTratativa from "./pages/tratativas/ConsultarTratativa";
import SolicitacaoTratativa from "./pages/tratativas/SolicitacaoTratativa";
import TratativasRH from "./pages/tratativas/TratativasRH";

import LancarAvaria from "./pages/avarias/LancarAvaria";
import CobrancasAvarias from "./pages/avarias/CobrancasAvarias";
import AprovacaoAvarias from "./pages/avarias/AprovacaoAvarias";
import AvariasEmRevisao from "./pages/avarias/AvariasEmRevisao";
import AvariasResumo from "./pages/avarias/AvariasResumo";
import AcidentesLancamento from "./pages/acidentes/AcidentesLancamento";
import AcidentesImagens from "./pages/acidentes/AcidentesImagens";
import AcidentesCentral from "./pages/acidentes/AcidentesCentral";
import SacLancamento from "./pages/sac/SacLancamento";
import SacCentral from "./pages/sac/SacCentral";
import SacResumo from "./pages/sac/SacResumo";

import SolicitacaoSOS from "./pages/intervencoes/SolicitacaoSOS";
import SOSFechamento from "./pages/intervencoes/SOSFechamento";
import SOSTratamento from "./pages/intervencoes/SOSTratamento";
import SOSCentral from "./pages/intervencoes/SOSCentral";
import SOSDashboard from "./pages/intervencoes/SOSDashboard";
import SOS_Resumo from "./pages/intervencoes/SOS_Resumo";
import KMRodado from "./pages/intervencoes/KMRodado";

import PCMInicio from "./pages/pcm/PCMInicio";
import PCMDiario from "./pages/pcm/PCMDiario";
import PCMResumo from "./pages/pcm/PCMResumo";
import PCM_Preventivas from "./pages/pcm/PCM_Preventivas";
import PCMTrocaPneus from "./pages/pcm/PCMTrocaPneus";
import PCMControleFichas from "./pages/pcm/PCMControleFichas";
import MobileHome from "./pages/home/MobileHome";
import { MobileTabBadgesProvider } from "./context/MobileTabBadgesContext";

import Usuarios from "./pages/configuracoes/Usuarios";
import NiveisAcesso from "./pages/configuracoes/NiveisAcesso";
import Funcionarios from "./pages/pessoas/Funcionarios";
import Ferias from "./pages/pessoas/Ferias";
import OrganogramaCanvas from "./pages/pessoas/OrganogramaCanvas";
import VagasCentral from "./pages/pessoas/VagasCentral";

import DesempenhoLancamento from "./pages/desempenho-diesel/DesempenhoLancamento";
import DesempenhoDieselResumo from "./pages/desempenho-diesel/DesempenhoDieselResumo";
import DesempenhoDieselAcompanhamento from "./pages/desempenho-diesel/DesempenhoDieselAcompanhamento";
import DesempenhoDieselTratativas from "./pages/desempenho-diesel/DesempenhoDieselTratativas";
import DesempenhoDieselAgente from "./pages/desempenho-diesel/DesempenhoDieselAgente";
import DesempenhoDieselCheckpoint from "./pages/desempenho-diesel/DesempenhoDieselCheckpoint";
import Desempenho_Diesel_Tratativas_Central from "./pages/desempenho-diesel/Desempenho_Diesel_Tratativas_Central";
import DieselTratarTratativa from "./pages/desempenho-diesel/DieselTratarTratativa";
import DieselConsultarTratativa from "./pages/desempenho-diesel/DieselConsultarTratativa";

import EstoqueDieselResumo from "./pages/estoque-diesel/EstoqueDieselResumo";
import EstoqueDieselOperacao from "./pages/estoque-diesel/EstoqueDieselOperacao";
import EstoqueDieselPlanejamentoControle from "./pages/estoque-diesel/EstoqueDieselPlanejamentoControle";
import EstoqueDieselParametros from "./pages/estoque-diesel/EstoqueDieselParametros";
import EstoqueDieselRecebimento from "./pages/estoque-diesel/EstoqueDieselRecebimento";

import ChecklistCentral from "./pages/checklists/ChecklistCentral";

import EmbarcadosCentral from "./pages/embarcados/EmbarcadosCentral";
import EmbarcadosMovimentacoes from "./pages/embarcados/EmbarcadosMovimentacoes";
import EmbarcadosReparos from "./pages/embarcados/EmbarcadosReparos";
import EmbarcadosEnvioManutencao from "./pages/embarcados/EmbarcadosEnvioManutencao";
import ReparoSolicitacaoDetalhes from "./components/embarcados/ReparoSolicitacaoDetalhes";
import ReparoSolicitacaoExecucao from "./components/embarcados/ReparoSolicitacaoExecucao";

import EstruturaFisicaSolicitacao from "./pages/estrutura-fisica/EstruturaFisicaSolicitacao";
import EstruturaFisicaCentral from "./pages/estrutura-fisica/EstruturaFisicaCentral";
import EstruturaFisicaConsultar from "./pages/estrutura-fisica/EstruturaFisicaConsultar";
import EstruturaFisicaTratar from "./pages/estrutura-fisica/EstruturaFisicaTratar";
import SuprimentosResumo from "./pages/suprimentos/SuprimentosResumo";
import SuprimentosGarantias from "./pages/suprimentos/SuprimentosGarantias";
import SuprimentosTestes from "./pages/suprimentos/SuprimentosTestes";
import SuprimentosServicoExterno from "./pages/suprimentos/SuprimentosServicoExterno";

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

          <InstallAppPrompt />
          <UpdateAppPrompt />
        </>
        </MobileTabBadgesProvider>
      </AccessProvider>
    </AuthProvider>
  );
}
