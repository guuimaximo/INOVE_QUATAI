import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabase";
import DateRangePopover from "../../components/DateRangePopover";
import {
  FaSearch,
  FaFilter,
  FaClock,
  FaExclamationCircle,
  FaCheckCircle,
  FaFolderOpen,
  FaTools,
  FaEye,
} from "react-icons/fa";

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

  const [sort, setSort] = useState({ key: "default", dir: "asc" });

  const [cards, setCards] = useState({
    total: 0,
    pendentes: 0,
    atrasadas: 0,
    concluidas: 0,
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
        concluidas: arr.filter((x) => x.status === "CONCLUIDO").length,
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

  return (
    <div className="min-h-screen space-y-5 bg-slate-50 p-4 md:p-6 text-slate-800">
      {/* Hero */}
      <div className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.24em] text-orange-600">
            Estrutura Física
          </div>
          <h1 className="mt-3 flex items-center gap-3 text-3xl font-black text-slate-900">
            <span className="rounded-2xl bg-orange-50 p-3 text-orange-600 shadow-sm">
              <FaTools />
            </span>
            Central de Manutenção
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Acompanhe pendências, atrasos por SLA e conclusões dos chamados de estrutura.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setViewMode(VIEW.ALL)}
            className={`rounded-full px-4 py-2 text-xs font-black uppercase tracking-wide transition ${
              viewMode === VIEW.ALL
                ? "bg-slate-900 text-white shadow-sm"
                : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            Ver tudo
          </button>

          <button
            onClick={() => setViewMode(VIEW.OPEN_ONLY)}
            className={`rounded-full px-4 py-2 text-xs font-black uppercase tracking-wide transition ${
              viewMode === VIEW.OPEN_ONLY
                ? "bg-orange-600 text-white shadow-sm"
                : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            Pendentes e atrasadas
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <h2 className="text-lg font-black text-slate-900">Filtros da central</h2>
          <p className="text-sm text-slate-500">
            Refine a visualização por texto, período, setor, prioridade e status.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <div className="relative md:col-span-2">
            <FaSearch className="absolute left-3 top-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar (pedido, solicitante, setor...)"
              value={filtros.busca}
              onChange={(e) => setFiltros({ ...filtros, busca: e.target.value })}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-9 pr-3 text-sm font-medium text-slate-700 outline-none transition focus:border-orange-400 focus:bg-white"
            />
          </div>

          <DateRangePopover
            from={filtros.dataInicio}
            to={filtros.dataFim}
            placeholder="Periodo"
            onChange={({ from, to }) => setFiltros((current) => ({ ...current, dataInicio: from, dataFim: to }))}
            onClear={() => setFiltros((current) => ({ ...current, dataInicio: "", dataFim: "" }))}
          />

          <div className="relative">
            <FaFilter className="absolute left-3 top-3.5 text-slate-400" />
            <select
              value={filtros.setor}
              onChange={(e) => setFiltros({ ...filtros, setor: e.target.value })}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-9 pr-3 text-sm font-medium text-slate-700 outline-none transition focus:border-orange-400 focus:bg-white"
            >
              <option value="">Todos os Setores</option>
              {setores.map((s) => (
                <option key={s.id} value={s.nome}>
                  {s.nome}
                </option>
              ))}
            </select>
          </div>

          <div className="relative">
            <FaFilter className="absolute left-3 top-3.5 text-slate-400" />
            <select
              value={filtros.prioridade}
              onChange={(e) => setFiltros({ ...filtros, prioridade: e.target.value })}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-9 pr-3 text-sm font-medium text-slate-700 outline-none transition focus:border-orange-400 focus:bg-white"
            >
              <option value="">Todas as Prioridades</option>
              <option value="URGENTE">Urgente</option>
              <option value="ALTA">Alta</option>
              <option value="MEDIA">Média</option>
              <option value="BAIXA">Baixa</option>
            </select>
          </div>

          <div className="relative">
            <FaFilter className="absolute left-3 top-3.5 text-slate-400" />
            <select
              value={filtros.status}
              onChange={(e) => setFiltros({ ...filtros, status: e.target.value })}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-9 pr-3 text-sm font-medium text-slate-700 outline-none transition focus:border-orange-400 focus:bg-white"
            >
              <option value="">Todos os Status</option>
              <option value="PENDENTE">Pendente</option>
              <option value="EM_ANALISE">Em Análise</option>
              <option value="EM_ANDAMENTO">Em Andamento</option>
              <option value="CONCLUIDO">Concluído</option>
              <option value="CANCELADO">Cancelado</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-2 flex-wrap">
          <button
            onClick={limparFiltros}
            className="rounded-2xl border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-200"
          >
            Limpar
          </button>
          <button
            onClick={aplicar}
            disabled={loading}
            className="rounded-2xl bg-orange-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-orange-700 disabled:bg-slate-400"
          >
            {loading ? "Aplicando..." : "Aplicar"}
          </button>
        </div>

        <div className="text-xs text-slate-500">
          Ordenação padrão: <b>Atrasadas</b> → <b>Prioridade</b> → <b>Mais recentes</b>.
          Clique no cabeçalho da tabela para ordenar; clique novamente para inverter; na
          terceira volta ao padrão.
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-slate-700">
            Regra de SLA para considerar como <span className="text-red-700">ATRASADA</span>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-700">
            <span className="px-2 py-1 rounded-full bg-red-100 text-red-800 font-bold">
              Urgente: 1 dia
            </span>
            <span className="px-2 py-1 rounded-full bg-orange-100 text-orange-800 font-bold">
              Alta: 3 dias
            </span>
            <span className="px-2 py-1 rounded-full bg-yellow-100 text-yellow-800 font-bold">
              Média: 7 dias
            </span>
            <span className="px-2 py-1 rounded-full bg-green-100 text-green-800 font-bold">
              Baixa: 15 dias
            </span>
            <span className="text-slate-500">
              (Atraso é calculado quando o <b>prazo estimado</b> está vencido e o
              status é diferente de Concluído/Cancelado)
            </span>
          </div>
        </div>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <CardResumo
          titulo="Total"
          valor={cards.total}
          icone={<FaFolderOpen className="text-4xl text-blue-50" />}
          border="border-l-blue-500"
        />
        <CardResumo
          titulo="Pendentes"
          valor={cards.pendentes}
          icone={<FaClock className="text-4xl text-yellow-50" />}
          border="border-l-yellow-500"
        />
        <CardResumo
          titulo="Concluídas"
          valor={cards.concluidas}
          icone={<FaCheckCircle className="text-4xl text-emerald-50" />}
          border="border-l-emerald-500"
        />
        <CardResumo
          titulo="Atrasadas (SLA)"
          valor={cards.atrasadas}
          icone={<FaExclamationCircle className="text-4xl text-red-50" />}
          border="border-l-red-500"
        />
      </div>

      {/* Mobile cards */}
      <div className="space-y-3 lg:hidden">
        {loading ? (
          <div className="rounded-3xl border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500 shadow-sm">
            Carregando...
          </div>
        ) : rowsOrdenadas.length === 0 ? (
          <div className="rounded-3xl border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500 shadow-sm">
            Nenhum registro encontrado.
          </div>
        ) : (
          rowsOrdenadas.map((row) => {
            const finalizada = isFinalizada(row?.status);
            const atrasada = isAtrasada(row);
            return (
              <div key={row.id} className={`rounded-3xl border bg-white p-4 shadow-sm ${atrasada ? "border-red-200" : "border-slate-200"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-slate-900">
                      #{row.numero_pedido} — {row.nome_solicitante || "-"}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {row.data_solicitacao
                        ? new Date(`${row.data_solicitacao}T00:00:00`).toLocaleDateString("pt-BR")
                        : "-"}
                    </div>
                  </div>
                  <div>{badgeStatus(row)}</div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      Setor
                    </div>
                    <div className="mt-1 text-slate-700">{row.setor || "-"}</div>
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      Prioridade
                    </div>
                    <div className="mt-1">{badgePrioridade(row.prioridade)}</div>
                  </div>
                </div>

                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => navigate(`/estrutura-fisica/consultar/${row.id}`)}
                    className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-slate-800 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-slate-900"
                  >
                    <FaEye size={13} /> Consultar
                  </button>
                  {!finalizada && (
                    <button
                      onClick={() => navigate(`/estrutura-fisica/tratar/${row.id}`)}
                      className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-orange-600 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-orange-700"
                    >
                      Dar baixa
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Tabela desktop */}
      <div className="hidden lg:block bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
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
                rowsOrdenadas.map((row) => {
                  const atrasada = isAtrasada(row);
                  return (
                    <tr key={row.id} className={`hover:bg-slate-50/80 transition-colors ${atrasada ? "bg-red-50/30" : ""}`}>
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
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-orange-600 hover:bg-orange-700 shadow-sm transition-colors"
                            >
                              Dar Baixa
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function CardResumo({ titulo, valor, icone, border }) {
  const tone =
    border?.includes("blue")
      ? "from-blue-50 to-cyan-50 border-blue-200 text-blue-700"
      : border?.includes("yellow")
      ? "from-amber-50 to-orange-50 border-amber-200 text-amber-700"
      : border?.includes("emerald")
      ? "from-emerald-50 to-teal-50 border-emerald-200 text-emerald-700"
      : border?.includes("red")
      ? "from-rose-50 to-pink-50 border-rose-200 text-rose-700"
      : "from-slate-50 to-gray-50 border-slate-200 text-slate-700";

  return (
    <div className={`min-h-[124px] rounded-3xl border bg-gradient-to-br p-4 shadow-sm ${tone}`}>
      <div className="flex h-full items-start justify-between gap-3">
        <div className="flex h-full min-w-0 flex-col justify-between">
          <p className="text-xs font-black uppercase tracking-[0.18em] opacity-80">{titulo}</p>
          <p className="mt-3 text-3xl font-black text-slate-900">{valor}</p>
        </div>
        <div className="text-2xl opacity-80">{icone}</div>
      </div>
    </div>
  );
}

function Th({ children, onClick, className = "" }) {
  return (
    <th
      onClick={onClick}
      className={`px-4 py-3 font-semibold whitespace-nowrap cursor-pointer select-none hover:text-slate-700 transition-colors ${className}`}
    >
      <div className={`flex items-center gap-1 ${className.includes("text-right") ? "justify-end" : ""}`}>
        {children}
      </div>
    </th>
  );
}
