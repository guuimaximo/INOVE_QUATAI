import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import Layout from "./components/Layout";
import Login from "./pages/Login";

import Dashboard from "./pages/Dashboard";
import InicioRapido from "./pages/InicioRapido";

import CentralTratativas from "./pages/CentralTratativas";
import TratativasResumo from "./pages/TratativasResumo";
import TratarTratativa from "./pages/TratarTratativa";
import ConsultarTratativa from "./pages/ConsultarTratativa";
import SolicitacaoTratativa from "./pages/SolicitacaoTratativa";
import TratativasRH from "./pages/TratativasRH";

import LancarAvaria from "./pages/LancarAvaria";
import CobrancasAvarias from "./pages/CobrancasAvarias";
import AprovacaoAvarias from "./pages/AprovacaoAvarias";
import AvariasEmRevisao from "./pages/AvariasEmRevisao";
import AvariasResumo from "./pages/AvariasResumo";

import SolicitacaoSOS from "./pages/SolicitacaoSOS";
import SOSFechamento from "./pages/SOSFechamento";
import SOSTratamento from "./pages/SOSTratamento";
import SOSCentral from "./pages/SOSCentral";
import SOSDashboard from "./pages/SOSDashboard";
import SOS_Resumo from "./pages/SOS_Resumo";

import KMRodado from "./pages/KMRodado";

import PCMInicio from "./pages/PCMInicio";
import PCMDiario from "./pages/PCMDiario";
import PCMResumo from "./pages/PCMResumo";
import PCM_Preventivas from "./pages/PCM_Preventivas"; // ADICIONADO

import Usuarios from "./pages/Usuarios";
import RequireAuth from "./routes/RequireAuth";

import DesempenhoLancamento from "./pages/DesempenhoLancamento";
import DesempenhoDieselResumo from "./pages/DesempenhoDieselResumo";
import DesempenhoDieselAcompanhamento from "./pages/DesempenhoDieselAcompanhamento";
import DesempenhoDieselTratativas from "./pages/DesempenhoDieselTratativas";
import DesempenhoDieselAgente from "./pages/DesempenhoDieselAgente";
import DesempenhoDieselCheckpoint from "./pages/DesempenhoDieselCheckpoint";

import ChecklistCentral from "./pages/ChecklistCentral";

// ✅ Embarcados
import EmbarcadosCentral from "./pages/EmbarcadosCentral";
import EmbarcadosMovimentacoes from "./pages/EmbarcadosMovimentacoes";
import EmbarcadosReparos from "./pages/EmbarcadosReparos";
import EmbarcadosEnvioManutencao from "./pages/EmbarcadosEnvioManutencao";
import ReparoSolicitacaoDetalhes from "./components/embarcados/ReparoSolicitacaoDetalhes";
import ReparoSolicitacaoExecucao from "./components/embarcados/ReparoSolicitacaoExecucao";

// ✅ Módulo separado Diesel
import Desempenho_Diesel_Tratativas_Central from "./pages/Desempenho_Diesel_Tratativas_Central";
import DieselTratarTratativa from "./pages/DieselTratarTratativa";
import DieselConsultarTratativa from "./pages/DieselConsultarTratativa";

// ✅ Estrutura Física
import EstruturaFisicaSolicitacao from "./pages/EstruturaFisicaSolicitacao";
import EstruturaFisicaCentral from "./pages/EstruturaFisicaCentral";
import EstruturaFisicaConsultar from "./pages/EstruturaFisicaConsultar";
import EstruturaFisicaTratar from "./pages/EstruturaFisicaTratar";

import { useContext } from "react";
import { AuthContext } from "./context/AuthContext";

function HomeDecider() {
  const { user } = useContext(AuthContext);

  const isAdmin = user?.nivel === "Administrador";
  const isGestor = user?.nivel === "Gestor";

  if (isAdmin || isGestor) return <Dashboard />;
  return <InicioRapido />;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route
          element={
            <RequireAuth>
              <Layout />
            </RequireAuth>
          }
        >
          <Route path="/" element={<HomeDecider />} />
          <Route path="/inove" element={<HomeDecider />} />
          <Route path="/inicio-rapido" element={<InicioRapido />} />

          {/* Desempenho Diesel (módulo atual) */}
          <Route path="/desempenho-lancamento" element={<DesempenhoLancamento />} />
          <Route path="/desempenho-diesel-resumo" element={<DesempenhoDieselResumo />} />
          <Route
            path="/desempenho-diesel-acompanhamento"
            element={<DesempenhoDieselAcompanhamento />}
          />
          <Route path="/desempenho-diesel-tratativas" element={<DesempenhoDieselTratativas />} />
          <Route path="/desempenho-diesel-agente" element={<DesempenhoDieselAgente />} />
          <Route path="/desempenho-diesel-checkpoint/:id" element={<DesempenhoDieselCheckpoint />} />
          <Route
            path="/desempenho-diesel"
            element={<Navigate to="/desempenho-diesel-resumo" replace />}
          />

          {/* ✅ Tratativas Diesel (módulo separado - novo trio) */}
          <Route
            path="/diesel-tratativas"
            element={<Desempenho_Diesel_Tratativas_Central />}
          />
          <Route path="/diesel-tratar/:id" element={<DieselTratarTratativa />} />
          <Route path="/diesel-consultar/:id" element={<DieselConsultarTratativa />} />

          {/* PCM */}
          <Route path="/pcm-inicio" element={<PCMInicio />} />
          <Route path="/pcm-resumo" element={<PCMResumo />} />
          <Route path="/pcm-diario/:id" element={<PCMDiario />} />
          <Route path="/pcm-preventivas" element={<PCM_Preventivas />} /> {/* ADICIONADO */}

          {/* Checklists */}
          <Route path="/checklists" element={<ChecklistCentral />} />

          {/* ✅ Embarcados */}
          <Route path="/embarcados-central" element={<EmbarcadosCentral />} />
          <Route path="/embarcados-movimentacoes" element={<EmbarcadosMovimentacoes />} />
          <Route path="/embarcados-reparos" element={<EmbarcadosReparos />} />
          <Route
            path="/embarcados-reparos/:id"
            element={<ReparoSolicitacaoDetalhes />}
          />
          <Route
            path="/embarcados-reparos/:id/executar"
            element={<ReparoSolicitacaoExecucao />}
          />
          <Route path="/embarcados-envio-manutencao" element={<EmbarcadosEnvioManutencao />} />
          <Route path="/embarcados" element={<Navigate to="/embarcados-central" replace />} />

          {/* Tratativas Gerais */}
          <Route path="/central" element={<CentralTratativas />} />
          <Route path="/tratativas-resumo" element={<TratativasResumo />} />
          <Route path="/tratar/:id" element={<TratarTratativa />} />
          <Route path="/consultar/:id" element={<ConsultarTratativa />} />
          <Route path="/solicitar" element={<SolicitacaoTratativa />} />
          <Route path="/tratativas-rh" element={<TratativasRH />} />

          {/* ✅ Estrutura Física */}
          <Route
            path="/estrutura-fisica/solicitacao"
            element={<EstruturaFisicaSolicitacao />}
          />
          <Route
            path="/estrutura-fisica/central"
            element={<EstruturaFisicaCentral />}
          />
          <Route
            path="/estrutura-fisica/consultar/:id"
            element={<EstruturaFisicaConsultar />}
          />
          <Route
            path="/estrutura-fisica/tratar/:id"
            element={<EstruturaFisicaTratar />}
          />
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

          {/* SOS */}
          <Route path="/sos-solicitacao" element={<SolicitacaoSOS />} />
          <Route path="/sos-fechamento" element={<SOSFechamento />} />
          <Route path="/sos-tratamento" element={<SOSTratamento />} />
          <Route path="/sos-central" element={<SOSCentral />} />
          <Route path="/sos-dashboard" element={<SOSDashboard />} />
          <Route path="/sos-resumo" element={<SOS_Resumo />} />

          {/* KM Rodado */}
          <Route path="/km-rodado" element={<KMRodado />} />

          {/* Configurações */}
          <Route path="/usuarios" element={<Usuarios />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
