// src/App.jsx
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

import KMRodado from "./pages/KMRodado";

import PCMInicio from "./pages/PCMInicio";
import PCMDiario from "./pages/PCMDiario";
import PCMResumo from "./pages/PCMResumo";

import Usuarios from "./pages/Usuarios";
import RequireAuth from "./routes/RequireAuth";

import DesempenhoLancamento from "./pages/DesempenhoLancamento";
import DesempenhoDieselResumo from "./pages/DesempenhoDieselResumo";
import DesempenhoDieselAcompanhamento from "./pages/DesempenhoDieselAcompanhamento";
import DesempenhoDieselTratativas from "./pages/DesempenhoDieselTratativas";
import DesempenhoDieselAgente from "./pages/DesempenhoDieselAgente";
import DesempenhoDieselCheckpoint from "./pages/DesempenhoDieselCheckpoint";

import ChecklistCentral from "./pages/ChecklistCentral";

// ✅ Módulo separado Diesel (novo trio)
import Diesel_tratativas_central from "./pages/Diesel_tratativas_central";
import Diesel_Tratativas_tratar from "./pages/Diesel_Tratativas_tratar";
import Diesel_Tratativas_consultar from "./pages/Diesel_Tratativas_consultar"; // ✅ CRIAR/IMPORTAR

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

          {/* Desempenho Diesel (seu módulo atual) */}
          <Route path="/desempenho-lancamento" element={<DesempenhoLancamento />} />
          <Route path="/desempenho-diesel-resumo" element={<DesempenhoDieselResumo />} />
          <Route path="/desempenho-diesel-acompanhamento" element={<DesempenhoDieselAcompanhamento />} />
          <Route path="/desempenho-diesel-tratativas" element={<DesempenhoDieselTratativas />} />
          <Route path="/desempenho-diesel-agente" element={<DesempenhoDieselAgente />} />
          <Route path="/desempenho-diesel-checkpoint/:id" element={<DesempenhoDieselCheckpoint />} />
          <Route path="/desempenho-diesel" element={<Navigate to="/desempenho-diesel-resumo" replace />} />

          {/* ✅ Tratativas Diesel (módulo separado - novo trio) */}
          <Route path="/diesel-tratativas" element={<Diesel_tratativas_central />} />
          <Route path="/diesel-tratar/:id" element={<Diesel_Tratativas_tratar />} />
          <Route path="/diesel-consultar/:id" element={<Diesel_Tratativas_consultar />} />

          {/* PCM */}
          <Route path="/pcm-inicio" element={<PCMInicio />} />
          <Route path="/pcm-resumo" element={<PCMResumo />} />
          <Route path="/pcm-diario/:id" element={<PCMDiario />} />

          {/* Checklists */}
          <Route path="/checklists" element={<ChecklistCentral />} />

          {/* Tratativas Gerais */}
          <Route path="/central" element={<CentralTratativas />} />
          <Route path="/tratativas-resumo" element={<TratativasResumo />} />
          <Route path="/tratar/:id" element={<TratarTratativa />} />
          <Route path="/consultar/:id" element={<ConsultarTratativa />} />
          <Route path="/solicitar" element={<SolicitacaoTratativa />} />
          <Route path="/tratativas-rh" element={<TratativasRH />} />

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
