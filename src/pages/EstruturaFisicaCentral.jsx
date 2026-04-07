import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase";

const VIEW = {
  OPEN_ONLY: "open_only",
  ALL: "all",
};

function norm(v) {
  return String(v || "").trim();
}

function isFinalizada(status) {
  const st = norm(status).toUpperCase();
  return st === "CONCLUIDO" || st === "CANCELADO";
}

function isAtrasada(row) {
  if (isFinalizada(row?.status)) return false;
  if (!row?.prazo_estimado) return false;
  const prazo = new Date(`${row.prazo_estimado}T00:00:00`);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return prazo < hoje;
}

function situacaoRank(row) {
  if (isAtrasada(row)) return 0;
  if (isFinalizada(row?.status)) return 2;
  return 1;
}

export default function CentralEstruturaFisica() {
  const navigate = useNavigate();

  const [rows, setRows] = useState([]);
  const [setores, setSetores] = useState([]);
  const [loading, setLoading] = useState(false);

  const [viewMode, setViewMode] = useState(VIEW.OPEN_ONLY);

  const [filtros, setFiltros] = useState({
    busca: "",
    dataInicio: "",
    dataFim: "",
    setor: "",
    prioridade: "",
    status: "",
  });

  const [sort, setSort] = useState({
    key: "default",
    dir: "asc",
  });

  const [cards, setCards] = useState({
    total: 0,
    pendentes: 0,
    atrasadas: 0,
    emAnalise: 0,
    emAndamento: 0,
    concluidas: 0,
    canceladas: 0,
  });

  function applyCommonFilters(query) {
    const f = filtros;

    if (f.busca) {
      query = query.or(
        `numero_pedido.eq.${Number(f.busca) || 0},nome_solicitante.ilike.%${f.busca}%,responsavel_area.ilike.%${f.busca}%,descricao_demanda.ilike.%${f.busca}%`
      );
    }

    if (f.setor) query = query.eq("setor", f.setor);
    if (f.prioridade) query = query.eq("prioridade", Number(f.prioridade));
    if (f.status) query = query.eq("status", f.status);

    if (f.dataInicio) query = query.gte("data_solicitacao", f.dataInicio);

    if (f.dataFim) {
      const dataFimAjustada = new Date(f.dataFim);
      dataFimAjustada.setDate(dataFimAjustada.getDate() + 1);
      query = query.lt("data_solicitacao", dataFimAjustada.toISOString().slice(0, 10));
    }

    return query;
  }

  async function carregarSetores() {
    try {
      const { data, error } = await supabase
        .from("estrutura_fisica_solicitacoes")
        .select("setor")
        .not("setor", "is", null)
        .limit(10000);

      if (error) throw error;

      const lista = Array.from(
        new Set((data || []).map((x) => String(x.setor || "").trim()).filter(Boolean))
      ).sort((a, b) => a.localeCompare(b, "pt-BR"));

      setSetores(lista);
    } catch (e) {
      console.error("Erro ao carregar setores:", e);
      setSetores([]);
    }
  }

  async function carregarLista() {
    let query = supabase.from("v_estrutura_fisica_central").select("*").limit(100000);
    query = applyCommonFilters(query);

    const { data, error } = await query.order("data_solicitacao", { ascending: false });
    if (error) {
      console.error("Erro ao carregar lista:", error);
      setRows([]);
      return;
    }

    setRows(data || []);
  }

  async function carregarCards() {
    try {
      let query = supabase.from("v_estrutura_fisica_central").select("*");
      query = applyCommonFilters(query);

      const { data, error } = await query;
      if (error) throw error;

      const arr = data || [];

      setCards({
        total: arr.length,
        pendentes: arr.filter((x) => !isFinalizada(x.status)).length,
        atrasadas: arr.filter((x) => isAtrasada(x)).length,
        emAnalise: arr.filter((x) => x.status === "EM_ANALISE").length,
        emAndamento: arr.filter((x) => x.status === "EM_ANDAMENTO").length,
        concluidas: arr.filter((x) => x.status === "CONCLUIDO").length,
        canceladas: arr.filter((x) => x.status === "CANCELADO").length,
      });
    } catch (e) {
      console.error("Erro ao carregar cards:", e);
    }
  }

  async function aplicar() {
    setLoading(true);
    try {
      await Promise.all([carregarLista(), carregarCards()]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregarSetores();
    aplicar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function limparFiltros() {
    setFiltros({
      busca: "",
      dataInicio: "",
      dataFim: "",
      setor: "",
      prioridade: "",
      status: "",
    });
    setTimeout(() => aplicar(), 0);
  }

  const rowsView = useMemo(() => {
    if (viewMode === VIEW.ALL) return rows;
    return rows.filter((r) => !isFinalizada(r.status));
  }, [rows, viewMode]);

  function defaultComparator(a, b) {
    const sa = situacaoRank(a);
    const sb = situacaoRank(b);
    if (sa !== sb) return sa - sb;

    const pa = Number(a?.prioridade || 0);
    const pb = Number(b?.prioridade || 0);
    if (pa !== pb) return pb - pa;

    const da = a?.data_solicitacao ? new Date(a.data_solicitacao).getTime() : 0;
    const db = b?.data_solicitacao ? new Date(b.data_solicitacao).getTime() : 0;
    return db - da;
  }

  const rowsOrdenadas = useMemo(() => {
    const arr = [...rowsView];

    if (sort.key === "default") {
      arr.sort(defaultComparator);
      return arr;
    }

    arr.sort((a, b) => {
      let va = a?.[sort.key];
      let vb = b?.[sort.key];

      if (sort.key === "prioridade" || sort.key === "numero_pedido") {
        va = Number(va || 0);
        vb = Number(vb || 0);
        return sort.dir === "asc" ? va - vb : vb - va;
      }

      if (sort.key === "data_solicitacao" || sort.key === "prazo_estimado") {
        va = va ? new Date(va).getTime() : 0;
        vb = vb ? new Date(vb).getTime() : 0;
        return sort.dir === "asc" ? va - vb : vb - va;
      }

      va = norm(va).toLowerCase();
      vb = norm(vb).toLowerCase();
      const r = va.localeCompare(vb, "pt-BR");
      return sort.dir === "asc" ? r : -r;
    });

    return arr;
  }, [rowsView, sort]);

  function toggleSort(key) {
    setSort((prev) => {
      if (prev.key !== key) return { key, dir: "asc" };
      if (prev.dir === "asc") return { key, dir: "desc" };
      return { key: "default", dir: "asc" };
    });
  }

  function SortIcon({ colKey }) {
    if (sort.key !== colKey) return <span className="ml-1 text-white/70">↕</span>;
    return <span className="ml-1">{sort.dir === "asc" ? "↑" : "↓"}</span>;
  }

  function badgePrioridade(p) {
    const v = Number(p);
    const base = "px-2 py-1 rounded text-xs font-medium";
    if (v === 5) return <span className={`${base} bg-red-100 text-red-800`}>5</span>;
    if (v === 4) return <span className={`${base} bg-orange-100 text-orange-800`}>4</span>;
    if (v === 3) return <span className={`${base} bg-yellow-100 text-yellow-800`}>3</span>;
    if (v === 2) return <span className={`${base} bg-blue-100 text-blue-800`}>2</span>;
    return <span className={`${base} bg-green-100 text-green-800`}>1</span>;
  }

  function badgeStatus(row) {
    const st = norm(row?.status).toUpperCase();

    if (st === "PENDENTE") {
      return (
        <span className="px-2 py-1 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
          Pendente
        </span>
      );
    }
    if (st === "EM_ANALISE") {
      return (
        <span className="px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800">
          Em análise
        </span>
      );
    }
    if (st === "EM_ANDAMENTO") {
      return (
        <span className="px-2 py-1 rounded text-xs font-medium bg-orange-100 text-orange-800">
          Em andamento
        </span>
      );
    }
    if (st === "CONCLUIDO") {
      return (
        <span className="px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800">
          Concluído
        </span>
      );
    }
    if (st === "CANCELADO") {
      return (
        <span className="px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-700">
          Cancelado
        </span>
      );
    }

    return (
      <span className="px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-700">
        {row?.status || "-"}
      </span>
    );
  }

  function badgeSituacao(row) {
    if (isFinalizada(row?.status)) {
      return (
        <span className="px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800">
          Finalizada
        </span>
      );
    }
    if (isAtrasada(row)) {
      return (
        <span className="px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-800">
          Atrasada
        </span>
      );
    }
    return (
      <span className="px-2 py-1 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
        Pendente
      </span>
    );
  }

  const cardClass =
    "rounded-xl border bg-white p-4 shadow-sm flex flex-col justify-center min-h-[92px]";

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h1 className="text-2xl font-bold text-gray-700">
          Central Controle Manutenção Estrutura Física
        </h1>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode(VIEW.ALL)}
            className={[
              "px-3 py-2 rounded-md text-sm border",
              viewMode === VIEW.ALL
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-gray-700 hover:bg-gray-50 border-gray-300",
            ].join(" ")}
          >
            VER TUDO
          </button>

          <button
            onClick={() => setViewMode(VIEW.OPEN_ONLY)}
            className={[
              "px-3 py-2 rounded-md text-sm border",
              viewMode === VIEW.OPEN_ONLY
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-gray-700 hover:bg-gray-50 border-gray-300",
            ].join(" ")}
          >
            PENDENTES & ATRASADAS
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3 mb-6">
        <div className={cardClass}>
          <span className="text-sm text-gray-500">Total</span>
          <span className="text-2xl font-black text-slate-800">{cards.total}</span>
        </div>
        <div className={cardClass}>
          <span className="text-sm text-gray-500">Pendentes</span>
          <span className="text-2xl font-black text-yellow-700">{cards.pendentes}</span>
        </div>
        <div className={cardClass}>
          <span className="text-sm text-gray-500">Atrasadas</span>
          <span className="text-2xl font-black text-red-700">{cards.atrasadas}</span>
        </div>
        <div className={cardClass}>
          <span className="text-sm text-gray-500">Em análise</span>
          <span className="text-2xl font-black text-blue-700">{cards.emAnalise}</span>
        </div>
        <div className={cardClass}>
          <span className="text-sm text-gray-500">Em andamento</span>
          <span className="text-2xl font-black text-orange-700">{cards.emAndamento}</span>
        </div>
        <div className={cardClass}>
          <span className="text-sm text-gray-500">Concluídas</span>
          <span className="text-2xl font-black text-green-700">{cards.concluidas}</span>
        </div>
        <div className={cardClass}>
          <span className="text-sm text-gray-500">Canceladas</span>
          <span className="text-2xl font-black text-gray-700">{cards.canceladas}</span>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg p-4 mb-6">
        <h2 className="text-lg font-semibold mb-3">Filtros</h2>

        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <input
            type="text"
            placeholder="Buscar..."
            value={filtros.busca}
            onChange={(e) => setFiltros({ ...filtros, busca: e.target.value })}
            className="border rounded-md px-3 py-2"
          />

          <input
            type="date"
            value={filtros.dataInicio}
            onChange={(e) => setFiltros({ ...filtros, dataInicio: e.target.value })}
            className="border rounded-md px-3 py-2"
          />

          <input
            type="date"
            value={filtros.dataFim}
            onChange={(e) => setFiltros({ ...filtros, dataFim: e.target.value })}
            className="border rounded-md px-3 py-2"
          />

          <select
            value={filtros.setor}
            onChange={(e) => setFiltros({ ...filtros, setor: e.target.value })}
            className="border rounded-md px-3 py-2 bg-white"
          >
            <option value="">Todos os Setores</option>
            {setores.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          <select
            value={filtros.prioridade}
            onChange={(e) => setFiltros({ ...filtros, prioridade: e.target.value })}
            className="border rounded-md px-3 py-2 bg-white"
          >
            <option value="">Todas as Prioridades</option>
            <option value="5">5</option>
            <option value="4">4</option>
            <option value="3">3</option>
            <option value="2">2</option>
            <option value="1">1</option>
          </select>

          <select
            value={filtros.status}
            onChange={(e) => setFiltros({ ...filtros, status: e.target.value })}
            className="border rounded-md px-3 py-2 bg-white"
          >
            <option value="">Todos os Status</option>
            <option value="PENDENTE">PENDENTE</option>
            <option value="EM_ANALISE">EM_ANALISE</option>
            <option value="EM_ANDAMENTO">EM_ANDAMENTO</option>
            <option value="CONCLUIDO">CONCLUIDO</option>
            <option value="CANCELADO">CANCELADO</option>
          </select>
        </div>

        <div className="flex justify-end mt-3">
          <button
            onClick={limparFiltros}
            className="bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300"
          >
            Limpar
          </button>
          <button
            onClick={aplicar}
            disabled={loading}
            className="ml-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400"
          >
            {loading ? "Aplicando..." : "Aplicar"}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg shadow">
        <table className="w-full bg-white text-sm">
          <thead className="bg-slate-700 text-white">
            <tr>
              <Th onClick={() => toggleSort("numero_pedido")}>
                Nº Pedido <SortIcon colKey="numero_pedido" />
              </Th>
              <Th onClick={() => toggleSort("data_solicitacao")}>
                Data <SortIcon colKey="data_solicitacao" />
              </Th>
              <Th onClick={() => toggleSort("nome_solicitante")}>
                Solicitante <SortIcon colKey="nome_solicitante" />
              </Th>
              <Th onClick={() => toggleSort("setor")}>
                Setor <SortIcon colKey="setor" />
              </Th>
              <Th onClick={() => toggleSort("responsavel_area")}>
                Responsável <SortIcon colKey="responsavel_area" />
              </Th>
              <Th>Demanda</Th>
              <Th onClick={() => toggleSort("prioridade")}>
                Prioridade <SortIcon colKey="prioridade" />
              </Th>
              <Th onClick={() => toggleSort("prazo_estimado")}>
                Prazo <SortIcon colKey="prazo_estimado" />
              </Th>
              <Th>Status</Th>
              <Th>Situação</Th>
              <Th>Quem vai realizar</Th>
              <Th>Valor gasto</Th>
              <Th>Ações</Th>
            </tr>
          </thead>

          <tbody>
            {rowsOrdenadas.length === 0 ? (
              <tr>
                <td colSpan={13} className="text-center p-6 text-gray-500">
                  Nenhum registro encontrado.
                </td>
              </tr>
            ) : (
              rowsOrdenadas.map((row) => (
                <tr key={row.id} className="border-t hover:bg-slate-50">
                  <td className="px-3 py-3 font-semibold">{row.numero_pedido}</td>
                  <td className="px-3 py-3">
                    {row.data_solicitacao
                      ? new Date(`${row.data_solicitacao}T00:00:00`).toLocaleDateString(
                          "pt-BR"
                        )
                      : "-"}
                  </td>
                  <td className="px-3 py-3">{row.nome_solicitante || "-"}</td>
                  <td className="px-3 py-3">{row.setor || "-"}</td>
                  <td className="px-3 py-3">{row.responsavel_area || "-"}</td>
                  <td className="px-3 py-3 max-w-[260px] truncate" title={row.descricao_demanda}>
                    {row.descricao_demanda || "-"}
                  </td>
                  <td className="px-3 py-3">{badgePrioridade(row.prioridade)}</td>
                  <td className="px-3 py-3">
                    {row.prazo_estimado
                      ? new Date(`${row.prazo_estimado}T00:00:00`).toLocaleDateString("pt-BR")
                      : "-"}
                  </td>
                  <td className="px-3 py-3">{badgeStatus(row)}</td>
                  <td className="px-3 py-3">{badgeSituacao(row)}</td>
                  <td className="px-3 py-3">{row.quem_vai_realizar || "-"}</td>
                  <td className="px-3 py-3">
                    {row.valor_gasto != null
                      ? Number(row.valor_gasto).toLocaleString("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        })
                      : "-"}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => navigate(`/estrutura-fisica/consultar/${row.id}`)}
                        className="px-3 py-1 rounded-md bg-slate-100 hover:bg-slate-200"
                      >
                        Consultar
                      </button>

                      {!isFinalizada(row.status) && (
                        <button
                          onClick={() => navigate(`/estrutura-fisica/tratar/${row.id}`)}
                          className="px-3 py-1 rounded-md bg-blue-600 text-white hover:bg-blue-700"
                        >
                          Tratar
                        </button>
                      )}
                    </div>
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

function Th({ children, onClick }) {
  return (
    <th
      onClick={onClick}
      className="px-3 py-3 text-left font-semibold whitespace-nowrap cursor-pointer select-none"
    >
      {children}
    </th>
  );
}
