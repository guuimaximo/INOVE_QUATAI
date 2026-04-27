import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabase";

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

export default function EstruturaFisicaCentral() {
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

  function isAtrasada(row) {
    if (isFinalizada(row?.status)) return false;
    if (!row?.prazo_estimado) return false;
    const prazo = new Date(`${row.prazo_estimado}T00:00:00`);
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    return prazo < hoje;
  }

  function applyCommonFilters(query) {
    const f = filtros;

    if (f.busca) {
      const buscaNum = Number(f.busca);
      if (!Number.isNaN(buscaNum) && String(buscaNum) === String(f.busca).trim()) {
        query = query.or(
          `numero_pedido.eq.${buscaNum},nome_solicitante.ilike.%${f.busca}%,setor.ilike.%${f.busca}%`
        );
      } else {
        query = query.or(
          `nome_solicitante.ilike.%${f.busca}%,setor.ilike.%${f.busca}%`
        );
      }
    }

    if (f.setor) query = query.eq("setor", f.setor);
    if (f.prioridade) query = query.eq("prioridade", f.prioridade);
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
        .from("setores")
        .select("id, nome")
        .order("nome", { ascending: true });

      if (error) throw error;
      setSetores(Array.isArray(data) ? data : []);
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
    const prioridadeOrdem = { URGENTE: 4, ALTA: 3, MEDIA: 2, BAIXA: 1 };

    const atrasadaA = isAtrasada(a) ? 1 : 0;
    const atrasadaB = isAtrasada(b) ? 1 : 0;
    if (atrasadaA !== atrasadaB) return atrasadaB - atrasadaA;

    const finalizadaA = isFinalizada(a?.status) ? 1 : 0;
    const finalizadaB = isFinalizada(b?.status) ? 1 : 0;
    if (finalizadaA !== finalizadaB) return finalizadaA - finalizadaB;

    const pa = prioridadeOrdem[a?.prioridade] || 0;
    const pb = prioridadeOrdem[b?.prioridade] || 0;
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

      if (sort.key === "numero_pedido") {
        va = Number(va || 0);
        vb = Number(vb || 0);
        return sort.dir === "asc" ? va - vb : vb - va;
      }

      if (sort.key === "data_solicitacao") {
        va = va ? new Date(va).getTime() : 0;
        vb = vb ? new Date(vb).getTime() : 0;
        return sort.dir === "asc" ? va - vb : vb - va;
      }

      const prioridadeOrdem = { URGENTE: 4, ALTA: 3, MEDIA: 2, BAIXA: 1 };
      if (sort.key === "prioridade") {
        va = prioridadeOrdem[va] || 0;
        vb = prioridadeOrdem[vb] || 0;
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
    if (sort.key !== colKey) return <span className="ml-1 text-slate-400">↕</span>;
    return <span className="ml-1 text-blue-600 font-bold">{sort.dir === "asc" ? "↑" : "↓"}</span>;
  }

  function badgePrioridade(p) {
    const v = norm(p).toUpperCase();
    const base = "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold shadow-sm border";

    if (v === "URGENTE") return <span className={`${base} bg-red-50 text-red-700 border-red-200`}>Urgente</span>;
    if (v === "ALTA") return <span className={`${base} bg-orange-50 text-orange-700 border-orange-200`}>Alta</span>;
    if (v === "MEDIA") return <span className={`${base} bg-yellow-50 text-yellow-700 border-yellow-200`}>Média</span>;
    return <span className={`${base} bg-green-50 text-green-700 border-green-200`}>Baixa</span>;
  }

  function badgeStatus(row) {
    const st = norm(row?.status).toUpperCase();
    const base = "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold shadow-sm border";

    if (st === "PENDENTE") return <span className={`${base} bg-yellow-50 text-yellow-700 border-yellow-200`}>Pendente</span>;
    if (st === "EM_ANALISE") return <span className={`${base} bg-blue-50 text-blue-700 border-blue-200`}>Em análise</span>;
    if (st === "EM_ANDAMENTO") return <span className={`${base} bg-orange-50 text-orange-700 border-orange-200`}>Em andamento</span>;
    if (st === "CONCLUIDO") return <span className={`${base} bg-green-50 text-green-700 border-green-200`}>Concluído</span>;
    if (st === "CANCELADO") return <span className={`${base} bg-slate-100 text-slate-700 border-slate-300`}>Cancelado</span>;

    return <span className={`${base} bg-slate-100 text-slate-700 border-slate-300`}>{row?.status || "-"}</span>;
  }

  const inputClass = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all";

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6 bg-slate-50 min-h-screen">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Controle de Manutenção
          </h1>
          <p className="text-sm text-slate-500 mt-1">Gerenciamento da estrutura física</p>
        </div>

        <div className="inline-flex bg-slate-200/50 p-1 rounded-lg border border-slate-200">
          <button
            onClick={() => setViewMode(VIEW.ALL)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
              viewMode === VIEW.ALL
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            Ver Tudo
          </button>
          <button
            onClick={() => setViewMode(VIEW.OPEN_ONLY)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
              viewMode === VIEW.OPEN_ONLY
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            Pendentes e Atrasadas
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-4">
        <Card label="Total" value={cards.total} color="text-slate-900" />
        <Card label="Pendentes" value={cards.pendentes} color="text-yellow-600" />
        <Card label="Atrasadas" value={cards.atrasadas} color="text-red-600" />
        <Card label="Em análise" value={cards.emAnalise} color="text-blue-600" />
        <Card label="Em andamento" value={cards.emAndamento} color="text-orange-600" />
        <Card label="Concluídas" value={cards.concluidas} color="text-green-600" />
        <Card label="Canceladas" value={cards.canceladas} color="text-slate-500" />
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4">Filtros</h2>

        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          <input
            type="text"
            placeholder="Buscar pedido ou setor..."
            value={filtros.busca}
            onChange={(e) => setFiltros({ ...filtros, busca: e.target.value })}
            className={inputClass}
          />
          <input
            type="date"
            value={filtros.dataInicio}
            onChange={(e) => setFiltros({ ...filtros, dataInicio: e.target.value })}
            className={inputClass}
          />
          <input
            type="date"
            value={filtros.dataFim}
            onChange={(e) => setFiltros({ ...filtros, dataFim: e.target.value })}
            className={inputClass}
          />
          <select
            value={filtros.setor}
            onChange={(e) => setFiltros({ ...filtros, setor: e.target.value })}
            className={inputClass}
          >
            <option value="">Todos os Setores</option>
            {setores.map((s) => (
              <option key={s.id} value={s.nome}>{s.nome}</option>
            ))}
          </select>
          <select
            value={filtros.prioridade}
            onChange={(e) => setFiltros({ ...filtros, prioridade: e.target.value })}
            className={inputClass}
          >
            <option value="">Prioridades</option>
            <option value="URGENTE">Urgente</option>
            <option value="ALTA">Alta</option>
            <option value="MEDIA">Média</option>
            <option value="BAIXA">Baixa</option>
          </select>
          <select
            value={filtros.status}
            onChange={(e) => setFiltros({ ...filtros, status: e.target.value })}
            className={inputClass}
          >
            <option value="">Status</option>
            <option value="PENDENTE">Pendente</option>
            <option value="EM_ANALISE">Em Análise</option>
            <option value="EM_ANDAMENTO">Em Andamento</option>
            <option value="CONCLUIDO">Concluído</option>
            <option value="CANCELADO">Cancelado</option>
          </select>
        </div>

        <div className="flex justify-end gap-3 mt-5">
          <button
            onClick={limparFiltros}
            className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
          >
            Limpar
          </button>
          <button
            onClick={aplicar}
            disabled={loading}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 shadow-sm disabled:opacity-50 transition-colors"
          >
            {loading ? "Aplicando..." : "Aplicar Filtros"}
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-xs font-semibold tracking-wider">
              <tr>
                <Th onClick={() => toggleSort("numero_pedido")}>Pedido <SortIcon colKey="numero_pedido" /></Th>
                <Th onClick={() => toggleSort("data_solicitacao")}>Data <SortIcon colKey="data_solicitacao" /></Th>
                <Th onClick={() => toggleSort("nome_solicitante")}>Solicitante <SortIcon colKey="nome_solicitante" /></Th>
                <Th onClick={() => toggleSort("setor")}>Setor <SortIcon colKey="setor" /></Th>
                <Th onClick={() => toggleSort("prioridade")}>Prioridade <SortIcon colKey="prioridade" /></Th>
                <Th>Status</Th>
                <Th className="text-right">Ações</Th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {rowsOrdenadas.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-slate-500">
                    Nenhum registro encontrado com os filtros atuais.
                  </td>
                </tr>
              ) : (
                rowsOrdenadas.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3 font-bold text-slate-700">#{row.numero_pedido}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {row.data_solicitacao
                        ? new Date(`${row.data_solicitacao}T00:00:00`).toLocaleDateString("pt-BR")
                        : "-"}
                    </td>
                    <td className="px-4 py-3 text-slate-700 font-medium">{row.nome_solicitante || "-"}</td>
                    <td className="px-4 py-3 text-slate-600">{row.setor || "-"}</td>
                    <td className="px-4 py-3">{badgePrioridade(row.prioridade)}</td>
                    <td className="px-4 py-3">{badgeStatus(row)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => navigate(`/estrutura-fisica/consultar/${row.id}`)}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                        >
                          Consultar
                        </button>
                        {!isFinalizada(row.status) && (
                          <button
                            onClick={() => navigate(`/estrutura-fisica/tratar/${row.id}`)}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-sm transition-colors"
                          >
                            Dar Baixa
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
    </div>
  );
}

function Card({ label, value, color }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-center">
      <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">{label}</span>
      <span className={`mt-1 text-3xl font-black ${color}`}>{value}</span>
    </div>
  );
}

function Th({ children, onClick, className = "" }) {
  return (
    <th
      onClick={onClick}
      className={`px-4 py-3 font-semibold whitespace-nowrap cursor-pointer select-none hover:text-slate-700 transition-colors ${className}`}
    >
      <div className={`flex items-center gap-1 ${className.includes('text-right') ? 'justify-end' : ''}`}>
        {children}
      </div>
    </th>
  );
}
