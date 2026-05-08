import { Routes, Route, Navigate } from "react-router-dom";
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

import Usuarios from "./pages/configuracoes/Usuarios";
import Funcionarios from "./pages/configuracoes/Funcionarios";
import NiveisAcesso from "./pages/configuracoes/NiveisAcesso";

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

function HomeDecider() {
  const { user } = useContext(AuthContext);
  const { profileMap } = useAccessGovernance();
  const isNativeShell = Capacitor.isNativePlatform();

  if (isNativeShell) {
    return <Navigate to="/pcm-troca-pneus" replace />;
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
                element={<DesempenhoDieselTratativas />}
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
              <Route path="/diesel-tratar/:id" element={<DieselTratarTratativa />} />
              <Route path="/diesel-consultar/:id" element={<DieselConsultarTratativa />} />

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

              {/* Avarias */}
              <Route path="/lancar-avaria" element={<LancarAvaria />} />
              <Route path="/aprovar-avarias" element={<AprovacaoAvarias />} />
              <Route path="/cobrancas" element={<CobrancasAvarias />} />
              <Route path="/avarias-resumo" element={<AvariasResumo />} />
              <Route path="/avarias-em-revisao" element={<AvariasEmRevisao />} />

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
              <Route path="/niveis-acesso" element={<NiveisAcesso />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>

          <InstallAppPrompt />
          <UpdateAppPrompt />
        </>
      </AccessProvider>
    </AuthProvider>
  );
}
