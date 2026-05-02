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

function CardResumo({ titulo, valor, cor, subValor = null, subValor2 = null }) {
  return (
    <div className={`${cor} rounded-2xl border border-white/60 p-4 text-left shadow-sm sm:p-5`}>
      <h3 className="text-sm font-medium text-gray-600">{titulo}</h3>
      <p className="mt-2 text-2xl font-bold text-gray-800 sm:text-3xl">{valor}</p>
      {subValor && <p className="mt-1 text-sm font-medium text-gray-700">{subValor}</p>}
      {subValor2 && <p className="text-xs font-medium text-gray-600">{subValor2}</p>}
    </div>
  );
}

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

  const carregarResumo = async () => {
    try {
      const totalTratQuery = applyDateFilters(
        supabase.from("tratativas").select("id", { count: "exact", head: true })
      );
      const { count: tratativasTotalCount } = await totalTratQuery;

      const pendentesQuery = applyDateFilters(
        supabase
          .from("tratativas")
          .select("id", { count: "exact", head: true })
          .ilike("status", "%pendente%")
      );
      const { count: tratativasPendentesCount } = await pendentesQuery;

      const concluidasQuery = applyDateFilters(
        supabase
          .from("tratativas")
          .select("id", { count: "exact", head: true })
          .or("status.ilike.%conclu%,status.ilike.%resolvid%")
      );
      const { count: tratativasConcluidasCount } = await concluidasQuery;

      const date10DaysAgo = new Date();
      date10DaysAgo.setDate(date10DaysAgo.getDate() - 10);

      const atrasadasQuery = applyDateFilters(
        supabase
          .from("tratativas")
          .select("id", { count: "exact", head: true })
          .ilike("status", "%pendente%")
          .lt("created_at", date10DaysAgo.toISOString())
      );
      const { count: tratativasAtrasadasCount } = await atrasadasQuery;

      const avsQuery = applyDateFilters(
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
          (sum, avaria) => sum + (avaria.valor_total_orcamento || 0),
          0
        ),
        avariasPendentesCobranca: avariasPendentesCobranca.length,
        avariasPendentesCobrancaValor: avariasPendentesCobranca.reduce(
          (sum, avaria) => sum + (avaria.valor_total_orcamento || 0),
          0
        ),
        cobrancasRealizadas: cobrancasRealizadas.length,
        cobrancasRealizadasValor: cobrancasRealizadas.reduce(
          (sum, avaria) => sum + (Number(avaria.valor_cobrado) || avaria.valor_total_orcamento || 0),
          0
        ),
        canceladasCount: canceladas.length,
        canceladasValor: canceladas.reduce(
          (sum, avaria) => sum + (avaria.valor_total_orcamento || 0),
          0
        ),
      });
    } catch (error) {
      console.error("Erro fatal ao carregar resumo:", error);
    }
  };

  const carregarEvolucao = async () => {
    const dateFilterStart =
      dataFiltro.dataInicio || new Date(Date.now() - 30 * 864e5).toISOString();

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
      let consulta = query.gte("created_at", dateFilterStart);
      if (dataFiltro.dataFim) consulta = consulta.lte("created_at", dataFiltro.dataFim);

      const { data } = await consulta.limit(100000);
      data?.forEach((item) => {
        const dia = new Date(item.created_at).toLocaleDateString("pt-BR");
        contagem[dia] =
          contagem[dia] || { dia, tratativas: 0, avariasAprovadas: 0, cobrancasRealizadas: 0 };
        contagem[dia][nome] += 1;
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

  const carregarTopMotoristas = async () => {
    const tratQuery = applyDateFilters(
      supabase
        .from("tratativas")
        .select("motorista_nome")
        .not("motorista_nome", "is", null)
        .limit(100000)
    );
    const { data: tratData } = await tratQuery;

    const avQuery = applyDateFilters(
      supabase
        .from("avarias")
        .select("motoristaId, valor_cobrado, valor_total_orcamento")
        .or("status_cobranca.eq.Cobrada,status_cobranca.eq.Pendente")
        .limit(100000)
    );
    const { data: avData } = await avQuery;

    if (!tratData || !avData) return;

    const contador = {};
    tratData.forEach((tratativa) => {
      contador[tratativa.motorista_nome] = (contador[tratativa.motorista_nome] || 0) + 1;
    });

    const top = Object.entries(contador)
      .map(([nome, qtd]) => {
        const valorAvs = avData
          .filter((avaria) => avaria.motoristaId?.includes(nome))
          .reduce(
            (sum, avaria) => sum + (Number(avaria.valor_cobrado) || avaria.valor_total_orcamento || 0),
            0
          );

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

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-600">
          Painel executivo
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              Gestao integrada de tratativas e avarias
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Usuario: <span className="font-semibold">{user?.nome || user?.login || "-"}</span> ·
              Nivel: <span className="font-semibold">{user?.nivel || "-"}</span>
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:p-5">
        <div className="flex flex-col gap-4 text-gray-700 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Filtro de periodo</h2>
            <p className="mt-1 text-sm text-slate-500">Ajuste o recorte quando precisar analisar um periodo especifico.</p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-end">
            <div className="flex flex-col">
              <label className="text-sm font-medium">Data inicio</label>
              <input
                type="date"
                value={dataFiltro.dataInicio}
                onChange={(event) =>
                  setDataFiltro({ ...dataFiltro, dataInicio: event.target.value })
                }
                className="mt-1 rounded-xl border border-slate-300 px-3 py-2.5 text-gray-700 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div className="flex flex-col">
              <label className="text-sm font-medium">Data fim</label>
              <input
                type="date"
                value={dataFiltro.dataFim}
                onChange={(event) =>
                  setDataFiltro({ ...dataFiltro, dataFim: event.target.value })
                }
                className="mt-1 rounded-xl border border-slate-300 px-3 py-2.5 text-gray-700 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <button
              onClick={() => setDataFiltro({ dataInicio: "", dataFim: "" })}
              className="rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
              type="button"
            >
              Limpar filtro
            </button>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Tratativas</h2>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <CardResumo
          titulo="Total Tratativas"
          valor={resumo.tratativasTotal}
          cor="bg-blue-100 text-blue-700"
        />
        <CardResumo
          titulo="Tratativas Pendentes"
          valor={resumo.tratativasPendentes}
          cor="bg-yellow-100 text-yellow-700"
        />
        <CardResumo
          titulo="Tratativas Concluidas"
          valor={resumo.tratativasConcluidas}
          cor="bg-green-100 text-green-700"
        />
        <CardResumo
          titulo="Tratativas Atrasadas"
          valor={resumo.tratativasAtrasadas}
          cor="bg-red-200 text-red-700"
        />
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Avarias e cobrancas</h2>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <CardResumo
          titulo="Avarias Aprovadas"
          valor={resumo.avariasAprovadas}
          subValor={formatCurrency(resumo.avariasAprovadasValor)}
          subValor2="Valor orcado"
          cor="bg-orange-100 text-orange-700"
        />
        <CardResumo
          titulo="Pendentes Cobranca"
          valor={resumo.avariasPendentesCobranca}
          subValor={formatCurrency(resumo.avariasPendentesCobrancaValor)}
          subValor2="Valor orcado"
          cor="bg-fuchsia-100 text-fuchsia-700"
        />
        <CardResumo
          titulo="Cobrancas Realizadas"
          valor={resumo.cobrancasRealizadas}
          subValor={formatCurrency(resumo.cobrancasRealizadasValor)}
          subValor2="Valor cobrado"
          cor="bg-lime-100 text-lime-700"
        />
        <CardResumo
          titulo="Cobrancas Canceladas"
          valor={resumo.canceladasCount}
          subValor={formatCurrency(resumo.canceladasValor)}
          subValor2="Valor cancelado"
          cor="bg-red-100 text-red-700"
        />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,0.95fr)]">
        <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:p-6">
          <div className="mb-4">
            <h2 className="text-lg font-medium text-gray-700">Evolucao dos ultimos 30 dias</h2>
            <p className="mt-1 text-sm text-slate-500">
              Leitura consolidada de tratativas, aprovacoes e cobrancas.
            </p>
          </div>

          <div className="h-72 w-full sm:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={evolucao}>
                <XAxis dataKey="dia" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="tratativas" stroke="#2563eb" name="Tratativas" />
                <Line
                  type="monotone"
                  dataKey="avariasAprovadas"
                  stroke="#f97316"
                  name="Avarias Aprovadas"
                />
                <Line
                  type="monotone"
                  dataKey="cobrancasRealizadas"
                  stroke="#16a34a"
                  name="Cobrancas Realizadas"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:p-6">
          <div className="mb-4">
            <h2 className="text-lg font-medium text-gray-700">
              Motoristas com mais tratativas
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              No celular a leitura vira cards; na web a tabela continua disponivel.
            </p>
          </div>

          <div className="space-y-3 md:hidden">
            {topMotoristas.length > 0 ? (
              topMotoristas.map((motorista, index) => (
                <div
                  key={index}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="text-sm font-semibold text-slate-900">{motorista.nome}</div>
                  <div className="mt-3 flex items-center justify-between text-sm text-slate-600">
                    <span>Qtd. tratativas</span>
                    <span className="font-semibold text-slate-900">{motorista.qtd}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-sm text-slate-600">
                    <span>Valor avarias</span>
                    <span className="font-semibold text-red-600">
                      {formatCurrency(motorista.valorAvs)}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500">
                Nenhum dado disponivel.
              </div>
            )}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="min-w-full">
              <thead>
                <tr className="bg-gray-100 text-left text-gray-700">
                  <th className="p-3">Motorista</th>
                  <th className="p-3 text-center">Qtd Tratativas</th>
                  <th className="p-3 text-right">Valor Avarias</th>
                </tr>
              </thead>
              <tbody>
                {topMotoristas.length > 0 ? (
                  topMotoristas.map((motorista, index) => (
                    <tr key={index} className="border-b hover:bg-gray-50">
                      <td className="p-3">{motorista.nome}</td>
                      <td className="p-3 text-center font-semibold">{motorista.qtd}</td>
                      <td className="p-3 text-right font-semibold text-red-600">
                        {formatCurrency(motorista.valorAvs)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="3" className="p-3 text-center text-gray-500">
                      Nenhum dado disponivel.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
