// src/pages/Dashboard.jsx
// (Versão final consolidada — sem botão do Farol)

import { useEffect, useState } from "react";
import { supabase } from "../../supabase";
import { useAuth } from "../../context/AuthContext";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

// ==========================
// COMPONENTE CARD RESUMO
// ==========================
function CardResumo({ titulo, valor, cor, subValor = null, subValor2 = null }) {
  return (
    <div className={`${cor} rounded-lg shadow p-5 text-center`}>
      <h3 className="text-sm font-medium text-gray-600">{titulo}</h3>
      <p className="text-3xl font-bold mt-2 text-gray-800">{valor}</p>
      {subValor && <p className="text-sm font-medium mt-1 text-gray-700">{subValor}</p>}
      {subValor2 && <p className="text-xs font-medium text-gray-600">{subValor2}</p>}
    </div>
  );
}

// ==========================
// COMPONENTE PRINCIPAL
// ==========================
export default function Dashboard() {
  const { user } = useAuth(); 

  const [resumo, setResumo] = useState({
    tratativasTotal: 0,
    tratativasPendentes: 0,
    tratativasConcluidas: 0,
    tratativasAtrasadas: 0,
    avariasAprovadas: 0,
    avariasAprovadasValor: 0,
    avariasPendentesCobranca: 0,
    avariasPendentesCobrancaValor: 0,
    cobrancasRealizadas: 0,
    cobrancasRealizadasValor: 0,
    canceladasCount: 0,
    canceladasValor: 0,
  });

  const [evolucao, setEvolucao] = useState([]);
  const [topMotoristas, setTopMotoristas] = useState([]);
  const [dataFiltro, setDataFiltro] = useState({ dataInicio: "", dataFim: "" });

  useEffect(() => {
    const timeoutId = setTimeout(carregarTudo, 0);
    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataFiltro]);

  const formatCurrency = (value) =>
    (value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const applyDateFilters = (query) => {
    if (dataFiltro.dataInicio) query = query.gte("created_at", dataFiltro.dataInicio);
    if (dataFiltro.dataFim) {
      const dataFimAjustada = new Date(dataFiltro.dataFim);
      dataFimAjustada.setDate(dataFimAjustada.getDate() + 1);
      query = query.lt("created_at", dataFimAjustada.toISOString());
    }
    return query;
  };

  // ==========================
  // RESUMO GERAL
  // ==========================
  const carregarResumo = async () => {
    try {
      // Tratativas
      let totalTratQuery = applyDateFilters(
        supabase.from("tratativas").select("id", { count: "exact", head: true })
      );
      const { count: tratativasTotalCount } = await totalTratQuery;

      let pendentesQuery = applyDateFilters(
        supabase
          .from("tratativas")
          .select("id", { count: "exact", head: true })
          .ilike("status", "%pendente%")
      );
      const { count: tratativasPendentesCount } = await pendentesQuery;

      let concluidasQuery = applyDateFilters(
        supabase
          .from("tratativas")
          .select("id", { count: "exact", head: true })
          .or("status.ilike.%conclu%,status.ilike.%resolvid%")
      );
      const { count: tratativasConcluidasCount } = await concluidasQuery;

      const date10DaysAgo = new Date();
      date10DaysAgo.setDate(date10DaysAgo.getDate() - 10);

      let atrasadasQuery = applyDateFilters(
        supabase
          .from("tratativas")
          .select("id", { count: "exact", head: true })
          .ilike("status", "%pendente%")
          .lt("created_at", date10DaysAgo.toISOString())
      );
      const { count: tratativasAtrasadasCount } = await atrasadasQuery;

      // Avarias
      let avsQuery = applyDateFilters(
        supabase
          .from("avarias")
          .select("status, status_cobranca, valor_total_orcamento, valor_cobrado, created_at")
          .limit(100000)
      );
      const { data: avsData } = await avsQuery;
      const avarias = avsData || [];

      const avariasAprovadas = avarias.filter((a) => a.status === "Aprovado");
      const avariasPendentesCobranca = avarias.filter((a) => a.status_cobranca === "Pendente");
      const cobrancasRealizadas = avarias.filter((a) => a.status_cobranca === "Cobrada");
      const canceladas = avarias.filter((a) => a.status_cobranca === "Cancelada");

      setResumo({
        tratativasTotal: tratativasTotalCount || 0,
        tratativasPendentes: tratativasPendentesCount || 0,
        tratativasConcluidas: tratativasConcluidasCount || 0,
        tratativasAtrasadas: tratativasAtrasadasCount || 0,
        avariasAprovadas: avariasAprovadas.length,
        avariasAprovadasValor: avariasAprovadas.reduce(
          (s, a) => s + (a.valor_total_orcamento || 0),
          0
        ),
        avariasPendentesCobranca: avariasPendentesCobranca.length,
        avariasPendentesCobrancaValor: avariasPendentesCobranca.reduce(
          (s, a) => s + (a.valor_total_orcamento || 0),
          0
        ),
        cobrancasRealizadas: cobrancasRealizadas.length,
        cobrancasRealizadasValor: cobrancasRealizadas.reduce(
          (s, a) => s + (Number(a.valor_cobrado) || a.valor_total_orcamento || 0),
          0
        ),
        canceladasCount: canceladas.length,
        canceladasValor: canceladas.reduce((s, a) => s + (a.valor_total_orcamento || 0), 0),
      });
    } catch (e) {
      console.error("Erro fatal ao carregar resumo:", e);
    }
  };

  // ==========================
  // EVOLUÇÃO (Gráfico)
  // ==========================
  const carregarEvolucao = async () => {
    let dateFilterStart = dataFiltro.dataInicio || new Date(Date.now() - 30 * 864e5).toISOString();

    const consultas = [
      { nome: "tratativas", query: supabase.from("tratativas").select("created_at") },
      {
        nome: "avariasAprovadas",
        query: supabase.from("avarias").select("created_at").ilike("status", "Aprovado"),
      },
      {
        nome: "cobrancasRealizadas",
        query: supabase.from("avarias").select("created_at").ilike("status_cobranca", "Cobrada"),
      },
    ];

    const contagem = {};
    for (const { nome, query } of consultas) {
      let q = query.gte("created_at", dateFilterStart);
      if (dataFiltro.dataFim) q = q.lte("created_at", dataFiltro.dataFim);

      const { data } = await q.limit(100000);
      data?.forEach((item) => {
        const dia = new Date(item.created_at).toLocaleDateString("pt-BR");
        contagem[dia] =
          contagem[dia] || { dia, tratativas: 0, avariasAprovadas: 0, cobrancasRealizadas: 0 };
        contagem[dia][nome]++;
      });
    }

    setEvolucao(
      Object.values(contagem).sort(
        (a, b) =>
          new Date(a.dia.split("/").reverse().join("-")) -
          new Date(b.dia.split("/").reverse().join("-"))
      )
    );
  };

  // ==========================
  // TOP MOTORISTAS
  // ==========================
  const carregarTopMotoristas = async () => {
    let tratQuery = applyDateFilters(
      supabase.from("tratativas").select("motorista_nome").not("motorista_nome", "is", null).limit(100000)
    );
    const { data: tratData } = await tratQuery;

    let avQuery = applyDateFilters(
      supabase
        .from("avarias")
        .select("motoristaId, valor_cobrado, valor_total_orcamento")
        .or("status_cobranca.eq.Cobrada,status_cobranca.eq.Pendente")
        .limit(100000)
    );
    const { data: avData } = await avQuery;

    if (!tratData || !avData) return;

    const contador = {};
    tratData.forEach((t) => (contador[t.motorista_nome] = (contador[t.motorista_nome] || 0) + 1));

    const top = Object.entries(contador)
      .map(([nome, qtd]) => {
        const valorAvs = avData
          .filter((av) => av.motoristaId?.includes(nome))
          .reduce((sum, av) => sum + (Number(av.valor_cobrado) || av.valor_total_orcamento || 0), 0);
        return { nome, qtd, valorAvs };
      })
      .sort((a, b) => b.qtd - a.qtd)
      .slice(0, 5);

    setTopMotoristas(top);
  };

  const carregarTudo = () => {
    carregarResumo();
    carregarEvolucao();
    carregarTopMotoristas();
  };

  // ==========================
  // INTERFACE
  // ==========================
  return (
    <div className="p-6">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-700">Painel de Gestão Integrada</h1>
          <p className="text-xs text-gray-500 mt-1">
            Usuário: <span className="font-semibold">{user?.nome || user?.login || "-"}</span>{" "}
            · Nível: <span className="font-semibold">{user?.nivel || "-"}</span>
          </p>
        </div>
      </div>

      {/* FILTROS DE DATA */}
      <div className="bg-white shadow rounded-lg p-4 mb-6 flex flex-wrap gap-4 items-center text-gray-700">
        <h2 className="text-lg font-semibold">Filtro de Período</h2>
        <div className="flex flex-col">
          <label className="text-sm font-medium">Data Início</label>
          <input
            type="date"
            value={dataFiltro.dataInicio}
            onChange={(e) => setDataFiltro({ ...dataFiltro, dataInicio: e.target.value })}
            className="border rounded-md px-3 py-2 text-gray-700"
          />
        </div>
        <div className="flex flex-col">
          <label className="text-sm font-medium">Data Fim</label>
          <input
            type="date"
            value={dataFiltro.dataFim}
            onChange={(e) => setDataFiltro({ ...dataFiltro, dataFim: e.target.value })}
            className="border rounded-md px-3 py-2 text-gray-700"
          />
        </div>
        <button
          onClick={() => setDataFiltro({ dataInicio: "", dataFim: "" })}
          className="bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-md px-4 py-2 mt-4"
          type="button"
        >
          Limpar Filtro
        </button>
      </div>

      {/* LINHA 1 — TRATATIVAS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <CardResumo titulo="Total Tratativas" valor={resumo.tratativasTotal} cor="bg-blue-100 text-blue-700" />
        <CardResumo titulo="Tratativas Pendentes" valor={resumo.tratativasPendentes} cor="bg-yellow-100 text-yellow-700" />
        <CardResumo titulo="Tratativas Concluídas" valor={resumo.tratativasConcluidas} cor="bg-green-100 text-green-700" />
        <CardResumo titulo="Tratativas Atrasadas" valor={resumo.tratativasAtrasadas} cor="bg-red-200 text-red-700" />
      </div>

      {/* LINHA 2 — AVARIAS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <CardResumo
          titulo="Avarias Aprovadas"
          valor={resumo.avariasAprovadas}
          subValor={formatCurrency(resumo.avariasAprovadasValor)}
          subValor2="Valor Orçado"
          cor="bg-orange-100 text-orange-700"
        />
        <CardResumo
          titulo="Pendentes Cobrança"
          valor={resumo.avariasPendentesCobranca}
          subValor={formatCurrency(resumo.avariasPendentesCobrancaValor)}
          subValor2="Valor Orçado"
          cor="bg-purple-100 text-purple-700"
        />
        <CardResumo
          titulo="Cobranças Realizadas"
          valor={resumo.cobrancasRealizadas}
          subValor={formatCurrency(resumo.cobrancasRealizadasValor)}
          subValor2="Valor Cobrado"
          cor="bg-lime-100 text-lime-700"
        />
        <CardResumo
          titulo="Cobranças Canceladas"
          valor={resumo.canceladasCount}
          subValor={formatCurrency(resumo.canceladasValor)}
          subValor2="Valor Cancelado"
          cor="bg-red-100 text-red-700"
        />
      </div>

      {/* GRÁFICO + TOP MOTORISTAS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium mb-4 text-gray-700">Evolução dos últimos 30 dias</h2>
          <div style={{ width: "100%", height: "300px" }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={evolucao}>
                <XAxis dataKey="dia" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="tratativas" stroke="#2563eb" name="Tratativas" />
                <Line type="monotone" dataKey="avariasAprovadas" stroke="#f97316" name="Avarias Aprovadas" />
                <Line type="monotone" dataKey="cobrancasRealizadas" stroke="#16a34a" name="Cobranças Realizadas" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium mb-4 text-gray-700">Motoristas com mais tratativas</h2>
          <table className="min-w-full">
            <thead>
              <tr className="bg-gray-100 text-gray-700 text-left">
                <th className="p-3">Motorista</th>
                <th className="p-3 text-center">Qtd Tratativas</th>
                <th className="p-3 text-right">Valor Avarias</th>
              </tr>
            </thead>
            <tbody>
              {topMotoristas.length > 0 ? (
                topMotoristas.map((m, i) => (
                  <tr key={i} className="border-b hover:bg-gray-50">
                    <td className="p-3">{m.nome}</td>
                    <td className="p-3 text-center font-semibold">{m.qtd}</td>
                    <td className="p-3 text-right font-semibold text-red-600">{formatCurrency(m.valorAvs)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="3" className="p-3 text-center text-gray-500">
                    Nenhum dado disponível.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
