import { useEffect, useState } from "react";
import { supabase } from "../../supabase";
import { FaSearch } from "react-icons/fa";

export default function Avarias() {
  const [avarias, setAvarias] = useState([]);
  const [filtro, setFiltro] = useState("");
  const [statusFiltro, setStatusFiltro] = useState("");
  const [loading, setLoading] = useState(true);
  const [resumo, setResumo] = useState({
    total: 0,
    pendentes: 0,
    enviadas: 0,
    concluidas: 0,
  });

  const carregarAvarias = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("avarias")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      let filtradas = data;

      if (filtro)
        filtradas = filtradas.filter((a) =>
          [a.prefixo, a.motorista_chapa, a.tipo_avaria, a.descricao]
            .join(" ")
            .toLowerCase()
            .includes(filtro.toLowerCase())
        );

      if (statusFiltro)
        filtradas = filtradas.filter((a) => a.status === statusFiltro);

      setAvarias(filtradas);

      setResumo({
        total: data.length,
        pendentes: data.filter((a) => a.status === "Pendente").length,
        enviadas: data.filter((a) => a.status === "Enviada para Cobrança").length,
        concluidas: data.filter((a) => a.status === "Concluída").length,
      });
    }
    setLoading(false);
  };

  useEffect(() => {
    carregarAvarias();
  }, [filtro, statusFiltro]);

  const enviarParaCobranca = async (avaria) => {
    const { error } = await supabase.from("cobrancas_avarias").insert([
      {
        id_avaria: avaria.id,
        motorista_chapa: avaria.motorista_chapa,
        prefixo: avaria.prefixo,
        valor_cobrado: avaria.valor_estimado,
        descricao_acao: `Cobrança criada automaticamente da avaria ${avaria.tipo_avaria}`,
        status_cobranca: "Pendente",
      },
    ]);

    if (!error) {
      await supabase
        .from("avarias")
        .update({ status: "Enviada para Cobrança" })
        .eq("id", avaria.id);
      alert("✅ Avaria enviada para cobrança com sucesso!");
      carregarAvarias();
    } else {
      alert("❌ Erro ao enviar para cobrança.");
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4 text-gray-700">
        Central de Avarias
      </h1>

      {/* Filtros */}
      <div className="bg-white p-4 shadow rounded-lg mb-6 flex flex-wrap gap-3 items-center">
        <div className="flex items-center border rounded-md px-2 flex-1">
          <FaSearch className="text-gray-400 mr-2" />
          <input
            type="text"
            placeholder="Buscar (prefixo, motorista, tipo...)"
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            className="flex-1 outline-none py-1"
          />
        </div>

        <select
          className="border rounded-md p-2"
          value={statusFiltro}
          onChange={(e) => setStatusFiltro(e.target.value)}
        >
          <option value="">Todos os Status</option>
          <option value="Pendente">Pendentes</option>
          <option value="Enviada para Cobrança">Enviadas</option>
          <option value="Concluída">Concluídas</option>
        </select>

        <button
          onClick={() => {
            setFiltro("");
            setStatusFiltro("");
          }}
          className="bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-md px-4 py-2"
        >
          Limpar
        </button>
      </div>

      {/* Cards resumo */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <CardResumo titulo="Total" valor={resumo.total} cor="bg-blue-100" />
        <CardResumo titulo="Pendentes" valor={resumo.pendentes} cor="bg-yellow-100" />
        <CardResumo titulo="Enviadas" valor={resumo.enviadas} cor="bg-orange-100" />
        <CardResumo titulo="Concluídas" valor={resumo.concluidas} cor="bg-green-100" />
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="min-w-full border-collapse">
          <thead>
            <tr className="bg-blue-600 text-white text-left">
              <th className="p-3">Data</th>
              <th className="p-3">Prefixo</th>

              {/* 🔵 NOVA COLUNA */
              }
              <th className="p-3">Nº Avaria</th>

              <th className="p-3">Motorista</th>
              <th className="p-3">Tipo</th>
              <th className="p-3">Valor</th>
              <th className="p-3">Status</th>
              <th className="p-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="8" className="text-center p-6">
                  Carregando...
                </td>
              </tr>
            ) : avarias.length === 0 ? (
              <tr>
                <td colSpan="8" className="text-center p-6 text-gray-500">
                  Nenhuma avaria encontrada.
                </td>
              </tr>
            ) : (
              avarias.map((a) => (
                <tr key={a.id} className="border-b hover:bg-gray-50">
                  <td className="p-3">{new Date(a.created_at).toLocaleDateString()}</td>
                  <td className="p-3">{a.prefixo}</td>

                  {/* 🔵 NOVA COLUNA MOSTRANDO O NÚMERO */}
                  <td className="p-3">{a.numero_da_avaria || "-"}</td>

                  <td className="p-3">{a.motorista_chapa}</td>
                  <td className="p-3">{a.tipo_avaria}</td>
                  <td className="p-3">R$ {a.valor_estimado?.toFixed(2) || "-"}</td>

                  <td className="p-3">
                    <span
                      className={`px-2 py-1 rounded text-sm ${
                        a.status === "Concluída"
                          ? "bg-green-100 text-green-800"
                          : a.status === "Enviada para Cobrança"
                          ? "bg-orange-100 text-orange-800"
                          : "bg-yellow-100 text-yellow-800"
                      }`}
                    >
                      {a.status}
                    </span>
                  </td>

                  <td className="p-3">
                    {a.status === "Pendente" ? (
                      <button
                        onClick={() => enviarParaCobranca(a)}
                        className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
                      >
                        Enviar p/ Cobrança
                      </button>
                    ) : (
                      <button className="bg-gray-600 text-white px-3 py-1 rounded hover:bg-gray-700">
                        Consultar
                      </button>
                    )}
                  </td>

                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CardResumo({ titulo, valor, cor }) {
  return (
    <div className={`${cor} rounded-lg p-4 shadow text-center`}>
      <h3 className="text-gray-600 text-sm">{titulo}</h3>
      <p className="text-2xl font-bold text-gray-800">{valor}</p>
    </div>
  );
}
