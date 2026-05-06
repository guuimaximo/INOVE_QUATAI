// src/pages/CobrancasAvarias.jsx
import { useEffect, useState, useMemo } from "react";
import { supabase } from "../../supabase";
import { FaSearch } from "react-icons/fa";
import CobrancaDetalheModal from "../../components/CobrancaDetalheModal";

function CardResumo({ titulo, valor, cor, subValor = null }) {
  return (
    <div className={`${cor} rounded-lg shadow p-5 text-center`}>
      <h3 className="text-sm font-medium text-gray-600">{titulo}</h3>
      <p className="text-3xl font-bold mt-2 text-gray-800">{valor}</p>
      {subValor !== null && <p className="text-xs font-medium mt-1">{subValor}</p>}
    </div>
  );
}

export default function CobrancasAvarias() {
  const [cobrancas, setCobrancas] = useState([]);
  const [filtro, setFiltro] = useState("");
  const [statusFiltro, setStatusFiltro] = useState("");
  const [loading, setLoading] = useState(true);

  // ✅ filtro de origem (Interno/Externo)
  const [origemFiltro, setOrigemFiltro] = useState("");

  const [resumo, setResumo] = useState({
    total: 0,
    pendentes: 0,
    cobradas: 0,
    canceladas: 0,
    totalAprovadoValue: 0,
    pendentesTotalValue: 0,
    cobradasTotalValue: 0, // soma valor_cobrado
    canceladasTotalValue: 0,
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedAvaria, setSelectedAvaria] = useState(null);

  // Filtro de período (data da avaria)
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");

  // sortConfig: key = campo, direction = 'asc' | 'desc'
  const [sortConfig, setSortConfig] = useState({
    key: "created_at",
    direction: "desc",
  });

  // =========================================================
  // Permissão de exclusão via tabela usuarios_aprovadores
  // =========================================================
  const [canDelete, setCanDelete] = useState(false);

  const carregarPermissaoExclusao = async () => {
    const { data: uData, error: uErr } = await supabase.auth.getUser();
    const user = uData?.user || null;

    if (uErr || !user?.email) {
      setCanDelete(false);
      return;
    }

    const { data: ua, error: uaErr } = await supabase
      .from("usuarios_aprovadores")
      .select("nivel, status_cadastro")
      .ilike("email", user.email)
      .maybeSingle();

    if (uaErr) {
      console.warn("Erro ao validar permissão de exclusão:", uaErr.message);
      setCanDelete(false);
      return;
    }

    setCanDelete(ua?.nivel === "Administrador" && ua?.status_cadastro === "Aprovado");
  };

  useEffect(() => {
    carregarPermissaoExclusao();

    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      carregarPermissaoExclusao();
    });

    return () => listener?.subscription?.unsubscribe?.();
  }, []);
  // =========================================================

  const formatCurrency = (value) =>
    value === null || value === undefined
      ? "-"
      : Number(value).toLocaleString("pt-BR", {
          style: "currency",
          currency: "BRL",
        });

  // =========================
  // Helpers para Data Cobrança e Origem
  // =========================
  const pickDataAvariaRaw = (c) => c.dataAvaria || c.data_avaria || c.created_at || null;
  const pickDataCobrancaRaw = (c) => c.data_cobranca || c.cobrado_em || null; // fallback
  const pickOrigemCobranca = (c) => c.origem || c.origem_cobranca || null; // fallback

  const normalizarOrigem = (v) => {
    const s = String(v || "").trim().toLowerCase();
    if (!s) return null;
    if (s === "interno" || s === "interna") return "Interno";
    if (s === "externo" || s === "externa") return "Externo";
    return v;
  };

  const carregarCobrancas = async () => {
    let query = supabase
      .from("avarias")
      .select("*")
      .eq("status", "Aprovado")
      .order("created_at", { ascending: false });

    if (statusFiltro) {
      query = query.eq("status_cobranca", statusFiltro);
    }

    if (origemFiltro) {
      query = query.or(`origem.ilike.${origemFiltro},origem_cobranca.ilike.${origemFiltro}`);
    }

    if (filtro) {
      query = query.or(
        `prefixo.ilike.%${filtro}%,motoristaId.ilike.%${filtro}%,numero_da_avaria.ilike.%${filtro}%`
      );
    }

    if (dataInicio) {
      query = query.gte("dataAvaria", dataInicio);
    }
    if (dataFim) {
      const fimISO = `${dataFim}T23:59:59`;
      query = query.lte("dataAvaria", fimISO);
    }

    const { data, error } = await query;
    if (error) {
      console.error("Erro ao carregar lista de cobranças:", error);
      setCobrancas([]);
    } else {
      setCobrancas(data || []);
    }
  };

  const carregarResumo = async () => {
    let query = supabase
      .from("avarias")
      .select("status_cobranca, valor_total_orcamento, valor_cobrado, dataAvaria, origem, origem_cobranca")
      .eq("status", "Aprovado");

    if (origemFiltro) {
      query = query.or(`origem.ilike.${origemFiltro},origem_cobranca.ilike.${origemFiltro}`);
    }

    if (dataInicio) {
      query = query.gte("dataAvaria", dataInicio);
    }
    if (dataFim) {
      const fimISO = `${dataFim}T23:59:59`;
      query = query.lte("dataAvaria", fimISO);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Erro ao carregar resumo:", error);
      return;
    }

    const pendentes = data.filter((c) => (c.status_cobranca || "Pendente") === "Pendente");
    const cobradas = data.filter((c) => c.status_cobranca === "Cobrada");
    const canceladas = data.filter((c) => c.status_cobranca === "Cancelada");

    setResumo({
      total: data.length,
      pendentes: pendentes.length,
      cobradas: cobradas.length,
      canceladas: canceladas.length,

      totalAprovadoValue: data.reduce((sum, a) => sum + (a.valor_total_orcamento || 0), 0),
      pendentesTotalValue: pendentes.reduce((sum, a) => sum + (a.valor_total_orcamento || 0), 0),
      cobradasTotalValue: cobradas.reduce((sum, a) => sum + (a.valor_cobrado || 0), 0),
      canceladasTotalValue: canceladas.reduce((sum, a) => sum + (a.valor_total_orcamento || 0), 0),
    });
  };

  const carregarTudo = async () => {
    setLoading(true);
    await Promise.all([carregarResumo(), carregarCobrancas()]);
    setLoading(false);
  };

  useEffect(() => {
    carregarTudo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtro, statusFiltro, origemFiltro, dataInicio, dataFim]);

  const handleVerDetalhes = (avaria) => {
    setSelectedAvaria(avaria);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setSelectedAvaria(null);
  };

  const handleAtualizarStatusCobranca = async (avariaId, novoStatus, updateData) => {
    const { error } = await supabase.from("avarias").update(updateData).eq("id", avariaId);

    if (!error) {
      alert(`✅ Cobrança marcada como ${novoStatus}`);
      handleCloseModal();
      carregarTudo();
    } else {
      alert(`❌ Erro ao atualizar status: ${error.message}`);
    }
  };

  // =========================================
  // Excluir avaria (somente Admin)
  // =========================================
  const handleExcluirAvaria = async (avaria) => {
    if (!canDelete) {
      alert("❌ Você não tem permissão para excluir avarias.");
      return;
    }
    if (!avaria?.id) return;

    const ok = window.confirm(
      `Tem certeza que deseja EXCLUIR a avaria Nº ${avaria.numero_da_avaria || "-"}?\n\nEssa ação remove o registro.`
    );
    if (!ok) return;

    const { error } = await supabase.from("avarias").delete().eq("id", avaria.id);

    if (error) {
      alert(`❌ Erro ao excluir: ${error.message}`);
      return;
    }

    alert("✅ Avaria excluída com sucesso.");
    handleCloseModal();
    carregarTudo();
  };
  // =========================================

  const formatarDataAvaria = (c) => {
    const dataRaw = pickDataAvariaRaw(c);
    if (!dataRaw) return "-";
    const d = new Date(dataRaw);
    if (Number.isNaN(d.getTime())) return "-";
    return d.toLocaleDateString("pt-BR");
  };

  const formatarDataAprovacao = (c) => {
    const dataRaw = c.aprovado_em;
    if (!dataRaw) return "-";
    const d = new Date(dataRaw);
    if (Number.isNaN(d.getTime())) return "-";
    return d.toLocaleDateString("pt-BR");
  };

  const formatarDataCobranca = (c) => {
    const dataRaw = pickDataCobrancaRaw(c);
    if (!dataRaw) return "-";
    const d = new Date(dataRaw);
    if (Number.isNaN(d.getTime())) return "-";
    return d.toLocaleDateString("pt-BR");
  };

  const calcularDeltaDias = (c) => {
    const dataAvariaRaw = pickDataAvariaRaw(c);
    const dataAprovRaw = c.aprovado_em;
    if (!dataAvariaRaw || !dataAprovRaw) return null;

    const dA = new Date(dataAvariaRaw);
    const dB = new Date(dataAprovRaw);

    if (Number.isNaN(dA.getTime()) || Number.isNaN(dB.getTime())) return null;

    const diffMs = dB.getTime() - dA.getTime();
    const diffDias = Math.round(diffMs / (1000 * 60 * 60 * 24));
    return diffDias;
  };

  const getSortValue = (item, key) => {
    switch (key) {
      case "numero_da_avaria":
        return Number(item.numero_da_avaria) || 0;

      case "data_avaria": {
        const dataRaw = pickDataAvariaRaw(item);
        return dataRaw ? new Date(dataRaw).getTime() : 0;
      }

      case "aprovado_em":
        return item.aprovado_em ? new Date(item.aprovado_em).getTime() : 0;

      case "data_cobranca": {
        const dataRaw = pickDataCobrancaRaw(item);
        return dataRaw ? new Date(dataRaw).getTime() : 0;
      }

      case "origem":
        return (normalizarOrigem(pickOrigemCobranca(item)) || "").toString().toLowerCase();

      case "delta_dias": {
        const delta = calcularDeltaDias(item);
        return delta ?? 0;
      }

      case "motoristaId":
        return item.motoristaId || "";

      case "prefixo":
        return item.prefixo || "";

      case "valor_total_orcamento":
        return Number(item.valor_total_orcamento) || 0;

      case "valor_cobrado":
        return Number(item.valor_cobrado) || 0;

      case "status_cobranca":
        return item.status_cobranca || "";

      case "created_at":
      default:
        return item.created_at ? new Date(item.created_at).getTime() : 0;
    }
  };

  const sortedCobrancas = useMemo(() => {
    const data = [...cobrancas];
    if (!sortConfig.key) return data;

    data.sort((a, b) => {
      const vA = getSortValue(a, sortConfig.key);
      const vB = getSortValue(b, sortConfig.key);

      if (vA === vB) return 0;
      if (vA > vB) return sortConfig.direction === "asc" ? 1 : -1;
      return sortConfig.direction === "asc" ? -1 : 1;
    });

    return data;
  }, [cobrancas, sortConfig]);

  const handleSort = (key) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        return { key, direction: prev.direction === "asc" ? "desc" : "asc" };
      }
      return { key, direction: "asc" };
    });
  };

  const renderSortIndicator = (key) => {
    if (sortConfig.key !== key) return null;
    return sortConfig.direction === "asc" ? " ▲" : " ▼";
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4 text-gray-700">Central de Cobranças de Avarias</h1>

      {/* Filtros */}
      <div className="bg-white p-4 shadow rounded-lg mb-6 flex flex-wrap gap-3 items-center">
        <div className="flex items-center border rounded-md px-2 flex-1 min-w-[220px]">
          <FaSearch className="text-gray-400 mr-2" />
          <input
            type="text"
            placeholder="Buscar (motorista, prefixo, nº avaria...)"
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            className="flex-1 outline-none py-1"
          />
        </div>

        {/* Período */}
        <div className="flex flex-wrap gap-2 items-center">
          <div className="flex flex-col">
            <label className="text-xs text-gray-500 mb-1">Início</label>
            <input
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="border rounded-md p-2 text-sm"
            />
          </div>
          <div className="flex flex-col">
            <label className="text-xs text-gray-500 mb-1">Fim</label>
            <input
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              className="border rounded-md p-2 text-sm"
            />
          </div>
        </div>

        <select className="border rounded-md p-2" value={statusFiltro} onChange={(e) => setStatusFiltro(e.target.value)}>
          <option value="">Todos os Status</option>
          <option value="Pendente">Pendentes</option>
          <option value="Cobrada">Cobradas</option>
          <option value="Cancelada">Canceladas</option>
        </select>

        <select
          className="border rounded-md p-2"
          value={origemFiltro}
          onChange={(e) => setOrigemFiltro(e.target.value)}
          title="Filtrar por origem"
        >
          <option value="">Todas as Origens</option>
          <option value="Interno">Interno</option>
          <option value="Externo">Externo</option>
        </select>

        <button
          onClick={() => {
            setFiltro("");
            setStatusFiltro("");
            setOrigemFiltro("");
            setDataInicio("");
            setDataFim("");
          }}
          className="bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-md px-4 py-2"
        >
          Limpar
        </button>
      </div>

      {/* Cards resumo */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <CardResumo titulo="Total Aprovado" valor={resumo.total} subValor={formatCurrency(resumo.totalAprovadoValue)} cor="bg-blue-100 text-blue-700" />
        <CardResumo titulo="Pendentes Cobrança" valor={resumo.pendentes} subValor={formatCurrency(resumo.pendentesTotalValue)} cor="bg-yellow-100 text-yellow-700" />
        <CardResumo titulo="Cobradas" valor={resumo.cobradas} subValor={formatCurrency(resumo.cobradasTotalValue)} cor="bg-green-100 text-green-700" />
        <CardResumo titulo="Canceladas" valor={resumo.canceladas} subValor={formatCurrency(resumo.canceladasTotalValue)} cor="bg-red-100 text-red-700" />
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="min-w-full border-collapse">
          <thead>
            <tr className="bg-blue-600 text-white text-left">
              <th className="p-3 cursor-pointer select-none" onClick={() => handleSort("numero_da_avaria")}>
                Nº Avaria{renderSortIndicator("numero_da_avaria")}
              </th>
              <th className="p-3 cursor-pointer select-none" onClick={() => handleSort("data_avaria")}>
                Data da Avaria{renderSortIndicator("data_avaria")}
              </th>
              <th className="p-3 cursor-pointer select-none" onClick={() => handleSort("aprovado_em")}>
                Data Aprovação{renderSortIndicator("aprovado_em")}
              </th>
              <th className="p-3 cursor-pointer select-none" onClick={() => handleSort("data_cobranca")}>
                Data Cobrança{renderSortIndicator("data_cobranca")}
              </th>
              <th className="p-3 cursor-pointer select-none" onClick={() => handleSort("origem")}>
                Origem{renderSortIndicator("origem")}
              </th>
              <th className="p-3 cursor-pointer select-none" onClick={() => handleSort("delta_dias")}>
                Δ (dias){renderSortIndicator("delta_dias")}
              </th>
              <th className="p-3 cursor-pointer select-none" onClick={() => handleSort("motoristaId")}>
                Motorista{renderSortIndicator("motoristaId")}
              </th>
              <th className="p-3 cursor-pointer select-none" onClick={() => handleSort("prefixo")}>
                Prefixo{renderSortIndicator("prefixo")}
              </th>
              <th className="p-3 cursor-pointer select-none" onClick={() => handleSort("valor_total_orcamento")}>
                Valor Orçado{renderSortIndicator("valor_total_orcamento")}
              </th>
              <th className="p-3 cursor-pointer select-none" onClick={() => handleSort("valor_cobrado")}>
                Valor Cobrado{renderSortIndicator("valor_cobrado")}
              </th>
              <th className="p-3 cursor-pointer select-none" onClick={() => handleSort("status_cobranca")}>
                Status Cobrança{renderSortIndicator("status_cobranca")}
              </th>
              <th className="p-3">Ações</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan="12" className="text-center p-6 text-gray-500">
                  Carregando...
                </td>
              </tr>
            ) : sortedCobrancas.length === 0 ? (
              <tr>
                <td colSpan="12" className="text-center p-6 text-gray-500">
                  Nenhuma cobrança encontrada.
                </td>
              </tr>
            ) : (
              sortedCobrancas.map((c) => {
                const deltaDias = calcularDeltaDias(c);
                const statusCobranca = c.status_cobranca || "Pendente";
                const origem = normalizarOrigem(pickOrigemCobranca(c)) || "-";

                return (
                  <tr key={c.id} className="border-b hover:bg-gray-50">
                    <td className="p-3 text-gray-700">{c.numero_da_avaria || "-"}</td>
                    <td className="p-3 text-gray-700">{formatarDataAvaria(c)}</td>
                    <td className="p-3 text-gray-700">{formatarDataAprovacao(c)}</td>
                    <td className="p-3 text-gray-700">{formatarDataCobranca(c)}</td>
                    <td className="p-3 text-gray-700">{origem}</td>

                    <td className="p-3">
                      {deltaDias !== null ? (
                        <span className={`font-semibold ${deltaDias > 7 ? "text-red-600" : "text-green-600"}`}>
                          {deltaDias}d
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>

                    <td className="p-3 text-gray-700">{c.motoristaId || "-"}</td>
                    <td className="p-3 text-gray-700">{c.prefixo || "-"}</td>

                    <td className="p-3 text-gray-700">{formatCurrency(c.valor_total_orcamento)}</td>
                    <td className="p-3 text-gray-900 font-medium">{formatCurrency(c.valor_cobrado)}</td>

                    <td className="p-3">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          statusCobranca === "Cobrada"
                            ? "bg-green-100 text-green-800"
                            : statusCobranca === "Cancelada"
                            ? "bg-red-100 text-red-800"
                            : "bg-yellow-100 text-yellow-800"
                        }`}
                      >
                        {statusCobranca}
                      </span>
                    </td>

                    <td className="p-3">
                      {statusCobranca === "Pendente" ? (
                        <button
                          onClick={() => handleVerDetalhes(c)}
                          className="flex items-center gap-1 bg-yellow-500 text-white px-3 py-1 rounded-md hover:bg-yellow-600 text-sm"
                        >
                          💰 Cobrar
                        </button>
                      ) : statusCobranca === "Cobrada" ? (
                        <button
                          onClick={() => handleVerDetalhes(c)}
                          className="flex items-center gap-1 bg-green-600 text-white px-3 py-1 rounded-md hover:bg-green-700 text-sm"
                        >
                          ✏️ Editar
                        </button>
                      ) : (
                        // ✅ ALTERADO: Cancelada agora mostra Editar (não mais só Detalhes)
                        <button
                          onClick={() => handleVerDetalhes(c)}
                          className="flex items-center gap-1 bg-blue-600 text-white px-3 py-1 rounded-md hover:bg-blue-700 text-sm"
                        >
                          ✏️ Editar
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <CobrancaDetalheModal
          avaria={selectedAvaria}
          onClose={handleCloseModal}
          onAtualizarStatus={handleAtualizarStatusCobranca}
          canDelete={canDelete}
          onExcluir={() => handleExcluirAvaria(selectedAvaria)}
        />
      )}
    </div>
  );
}
