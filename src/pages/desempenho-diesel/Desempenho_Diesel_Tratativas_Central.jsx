import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabase";
import {
  FaSearch,
  FaFilter,
  FaClock,
  FaExclamationCircle,
  FaCheckCircle,
  FaFolderOpen,
  FaGavel,
  FaSort,
  FaSortUp,
  FaSortDown,
  FaEye,
} from "react-icons/fa";

const VIEW = {
  OPEN_ONLY: "open_only",
  ALL: "all",
};

const SLA_DIAS = {
  "Gravíssima": 1,
  Gravissima: 1,
  Alta: 3,
  "Média": 7,
  Media: 7,
  Baixa: 15,
};

const PRIORIDADE_RANK = {
  "Gravíssima": 0,
  Gravissima: 0,
  Alta: 1,
  "Média": 2,
  Media: 2,
  Baixa: 3,
};

function norm(s) {
  return String(s || "").trim();
}

function isPendente(status) {
  return norm(status).toLowerCase().includes("pendente");
}

function isConcluidaOuResolvida(status) {
  const st = norm(status).toLowerCase();
  return st.includes("conclu") || st.includes("resolvid");
}

function daysDiffFromNow(createdAtISO) {
  const dt = createdAtISO ? new Date(createdAtISO) : null;
  if (!dt || Number.isNaN(dt.getTime())) return 0;
  const now = new Date();
  const diffMs = now.getTime() - dt.getTime();
  return diffMs / (1000 * 60 * 60 * 24);
}

function getSlaDias(prioridade) {
  const p = norm(prioridade);
  return SLA_DIAS[p] ?? 7;
}

function isAtrasadaBySLA(row) {
  if (!isPendente(row?.status)) return false;
  const sla = getSlaDias(row?.prioridade);
  return daysDiffFromNow(row?.created_at) > sla;
}

function isPendenteNoPrazo(row) {
  return isPendente(row?.status) && !isAtrasadaBySLA(row);
}

function statusRank(row) {
  if (isAtrasadaBySLA(row)) return 0;
  if (isPendenteNoPrazo(row)) return 1;
  if (isConcluidaOuResolvida(row?.status)) return 2;
  return 3;
}

export default function Desempenho_Diesel_Tratativas_Central() {
  const [tratativas, setTratativas] = useState([]);
  const [filtros, setFiltros] = useState({
    busca: "",
    dataInicio: "",
    dataFim: "",
    status: "",
    prioridade: "",
  });
  const [loading, setLoading] = useState(false);

  const [viewMode, setViewMode] = useState(VIEW.OPEN_ONLY);

  const [sort, setSort] = useState({
    key: "default",
    dir: "asc",
  });

  const [totalCount, setTotalCount] = useState(0);
  const [pendentesCount, setPendentesCount] = useState(0);
  const [concluidasCount, setConcluidasCount] = useState(0);
  const [atrasadasCount, setAtrasadasCount] = useState(0);

  const navigate = useNavigate();

  function applyCommonFilters(query) {
    const f = filtros;

    if (f.busca) {
      query = query.or(
        `motorista_nome.ilike.%${f.busca}%,motorista_chapa.ilike.%${f.busca}%,descricao.ilike.%${f.busca}%,tipo_ocorrencia.ilike.%${f.busca}%`
      );
    }

    if (f.status) query = query.ilike("status", `%${f.status}%`);
    if (f.prioridade) query = query.eq("prioridade", f.prioridade);

    if (f.dataInicio) query = query.gte("created_at", f.dataInicio);

    if (f.dataFim) {
      const dataFimAjustada = new Date(f.dataFim);
      dataFimAjustada.setDate(dataFimAjustada.getDate() + 1);
      query = query.lt("created_at", dataFimAjustada.toISOString().split("T")[0]);
    }

    return query;
  }

  async function carregarLista() {
    let query = supabase.from("diesel_tratativas").select("*").limit(100000);
    query = applyCommonFilters(query);

    const { data, error } = await query.order("created_at", { ascending: false });
    if (!error) setTratativas(data || []);
    else console.error("Erro ao carregar lista diesel_tratativas:", error);
  }

  async function carregarContadoresHead() {
    let qTotal = supabase
      .from("diesel_tratativas")
      .select("id", { count: "exact", head: true });
    qTotal = applyCommonFilters(qTotal);
    const { count: total } = await qTotal;

    let qConc = supabase
      .from("diesel_tratativas")
      .select("id", { count: "exact", head: true })
      .or("status.ilike.%conclu%,status.ilike.%resolvid%");
    qConc = applyCommonFilters(qConc);
    const { count: conc } = await qConc;

    setTotalCount(total || 0);
    setConcluidasCount(conc || 0);
  }

  async function aplicar() {
    setLoading(true);
    try {
      await Promise.all([carregarLista(), carregarContadoresHead()]);
    } catch (e) {
      console.error("Erro ao aplicar filtros (diesel):", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    aplicar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function limparFiltros() {
    setFiltros({
      busca: "",
      dataInicio: "",
      dataFim: "",
      status: "",
      prioridade: "",
    });
    setTimeout(() => aplicar(), 0);
  }

  const tratativasFiltradasClient = useMemo(() => {
    return Array.isArray(tratativas) ? tratativas : [];
  }, [tratativas]);

  useEffect(() => {
    const rows = Array.isArray(tratativasFiltradasClient) ? tratativasFiltradasClient : [];

    const pendentesSomente = rows.filter((r) => isPendenteNoPrazo(r)).length;
    const atrasadasSomente = rows.filter((r) => isAtrasadaBySLA(r)).length;

    setPendentesCount(pendentesSomente);
    setAtrasadasCount(atrasadasSomente);
  }, [tratativasFiltradasClient]);

  const tratativasView = useMemo(() => {
    const rows = Array.isArray(tratativas) ? tratativas : [];
    if (viewMode === VIEW.ALL) return rows;
    return rows.filter((r) => isPendente(r?.status));
  }, [tratativas, viewMode]);

  function defaultComparator(a, b) {
    const pa = PRIORIDADE_RANK[norm(a?.prioridade)] ?? 99;
    const pb = PRIORIDADE_RANK[norm(b?.prioridade)] ?? 99;
    if (pa !== pb) return pa - pb;

    const sa = statusRank(a);
    const sb = statusRank(b);
    if (sa !== sb) return sa - sb;

    const da = a?.created_at ? new Date(a.created_at).getTime() : 0;
    const db = b?.created_at ? new Date(b.created_at).getTime() : 0;
    return db - da;
  }

  function stringComparator(getter, dir, a, b) {
    const va = norm(getter(a)).toLowerCase();
    const vb = norm(getter(b)).toLowerCase();
    const r = va.localeCompare(vb, "pt-BR");
    return dir === "asc" ? r : -r;
  }

  const tratativasOrdenadas = useMemo(() => {
    const rows = [...(tratativasView || [])];

    if (sort.key === "default") {
      rows.sort(defaultComparator);
      return rows;
    }

    rows.sort((a, b) => {
      if (sort.key === "created_at") {
        const da = a?.created_at ? new Date(a.created_at).getTime() : 0;
        const db = b?.created_at ? new Date(b.created_at).getTime() : 0;
        const r = da - db;
        return sort.dir === "asc" ? r : -r;
      }
      if (sort.key === "prioridade") {
        const pa = PRIORIDADE_RANK[norm(a?.prioridade)] ?? 99;
        const pb = PRIORIDADE_RANK[norm(b?.prioridade)] ?? 99;
        const r = pa - pb;
        return sort.dir === "asc" ? r : -r;
      }
      if (sort.key === "status") {
        const ra = statusRank(a);
        const rb = statusRank(b);
        const r = ra - rb;
        return sort.dir === "asc" ? r : -r;
      }
      if (sort.key === "motorista_nome") {
        return stringComparator((x) => x?.motorista_nome, sort.dir, a, b);
      }
      if (sort.key === "tipo_ocorrencia") {
        return stringComparator((x) => x?.tipo_ocorrencia, sort.dir, a, b);
      }
      return 0;
    });

    return rows;
  }, [tratativasView, sort]);

  function toggleSort(key) {
    setSort((prev) => {
      if (prev.key !== key) return { key, dir: "asc" };
      if (prev.dir === "asc") return { key, dir: "desc" };
      return { key: "default", dir: "asc" };
    });
  }

  function SortIcon({ colKey }) {
    if (sort.key !== colKey || sort.key === "default") {
      return <FaSort className="inline ml-1 text-slate-400" />;
    }
    return sort.dir === "asc" ? (
      <FaSortUp className="inline ml-1 text-blue-600" />
    ) : (
      <FaSortDown className="inline ml-1 text-blue-600" />
    );
  }

  function badgePrioridade(p) {
    const v = norm(p);
    const base = "px-2 py-1 rounded-lg text-xs font-bold border";
    if (v === "Gravíssima" || v === "Gravissima") {
      return <span className={`${base} bg-red-50 text-red-700 border-red-200`}>Gravíssima</span>;
    }
    if (v === "Alta") {
      return <span className={`${base} bg-orange-50 text-orange-700 border-orange-200`}>Alta</span>;
    }
    if (v === "Média" || v === "Media") {
      return <span className={`${base} bg-yellow-50 text-yellow-700 border-yellow-200`}>Média</span>;
    }
    if (v === "Baixa") {
      return <span className={`${base} bg-green-50 text-green-700 border-green-200`}>Baixa</span>;
    }
    return <span className={`${base} bg-slate-50 text-slate-700 border-slate-200`}>{v || "-"}</span>;
  }

  function badgeStatus(row) {
    const st = norm(row?.status).toLowerCase();
    const atrasada = isAtrasadaBySLA(row);

    if (atrasada) {
      return (
        <span className="px-2 py-1 rounded-lg text-xs font-bold border bg-red-50 text-red-700 border-red-200">
          Atrasada
        </span>
      );
    }
    if (st.includes("pendente")) {
      return (
        <span className="px-2 py-1 rounded-lg text-xs font-bold border bg-yellow-50 text-yellow-700 border-yellow-200">
          Pendente
        </span>
      );
    }
    if (st.includes("resolvido") || st.includes("conclu")) {
      return (
        <span className="px-2 py-1 rounded-lg text-xs font-bold border bg-emerald-50 text-emerald-700 border-emerald-200">
          Resolvido
        </span>
      );
    }
    return (
      <span className="px-2 py-1 rounded-lg text-xs font-bold border bg-slate-50 text-slate-700 border-slate-200">
        {row?.status || "-"}
      </span>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto min-h-screen bg-[#f8f9fa] font-sans text-slate-800">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b pb-4 gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-slate-800">
            <FaGavel className="text-violet-500" /> Central de Tratativas — Diesel
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Acompanhe pendências, atrasos por SLA e resoluções das tratativas.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setViewMode(VIEW.ALL)}
            className={`px-4 py-2 rounded-lg text-sm font-bold border shadow-sm ${
              viewMode === VIEW.ALL
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
            }`}
          >
            VER TUDO
          </button>

          <button
            onClick={() => setViewMode(VIEW.OPEN_ONLY)}
            className={`px-4 py-2 rounded-lg text-sm font-bold border shadow-sm ${
              viewMode === VIEW.OPEN_ONLY
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
            }`}
          >
            PENDENTES & ATRASADAS
          </button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl border shadow-sm space-y-4">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Filtros</h2>
          <p className="text-sm text-slate-500">
            Refine a visualização por texto, período, prioridade e status.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div className="relative md:col-span-2">
            <FaSearch className="absolute left-3 top-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar (nome, chapa, descrição, ocorrência...)"
              value={filtros.busca}
              onChange={(e) => setFiltros({ ...filtros, busca: e.target.value })}
              className="pl-9 p-2.5 border rounded-lg w-full text-sm outline-none focus:border-blue-500 font-medium"
            />
          </div>

          <input
            type="date"
            value={filtros.dataInicio}
            onChange={(e) => setFiltros({ ...filtros, dataInicio: e.target.value })}
            className="p-2.5 border rounded-lg w-full text-sm outline-none focus:border-blue-500 font-medium"
          />

          <input
            type="date"
            value={filtros.dataFim}
            onChange={(e) => setFiltros({ ...filtros, dataFim: e.target.value })}
            className="p-2.5 border rounded-lg w-full text-sm outline-none focus:border-blue-500 font-medium"
          />

          <div className="relative">
            <FaFilter className="absolute left-3 top-3.5 text-slate-400" />
            <select
              value={filtros.prioridade}
              onChange={(e) => setFiltros({ ...filtros, prioridade: e.target.value })}
              className="pl-9 p-2.5 border rounded-lg w-full text-sm outline-none focus:border-blue-500 font-medium bg-white text-slate-700"
            >
              <option value="">Todas as Prioridades</option>
              <option value="Gravíssima">Gravíssima</option>
              <option value="Alta">Alta</option>
              <option value="Média">Média</option>
              <option value="Baixa">Baixa</option>
            </select>
          </div>

          <div className="relative">
            <FaFilter className="absolute left-3 top-3.5 text-slate-400" />
            <select
              value={filtros.status}
              onChange={(e) => setFiltros({ ...filtros, status: e.target.value })}
              className="pl-9 p-2.5 border rounded-lg w-full text-sm outline-none focus:border-blue-500 font-medium bg-white text-slate-700"
            >
              <option value="">Todos os Status</option>
              <option value="Pendente">Pendente</option>
              <option value="Resolvido">Resolvido</option>
              <option value="Concluída">Concluída</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-2 flex-wrap">
          <button
            onClick={limparFiltros}
            className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 font-bold text-sm"
          >
            Limpar
          </button>
          <button
            onClick={aplicar}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-400 font-bold text-sm"
          >
            {loading ? "Aplicando..." : "Aplicar"}
          </button>
        </div>

        <div className="text-xs text-slate-500">
          Ordenação padrão: <b>Prioridade</b> → <b>Status</b> → <b>Mais recentes</b>.
          Clique no cabeçalho da tabela para ordenar; clique novamente para inverter; na
          terceira volta ao padrão.
        </div>

        <div className="rounded-xl border bg-slate-50 p-3">
          <div className="text-xs font-bold text-slate-700 mb-2">
            Regra de SLA para considerar como <span className="text-red-700">ATRASADA</span>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-700">
            <span className="px-2 py-1 rounded-full bg-red-100 text-red-800 font-bold">
              Gravíssima: 1 dia
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
              (Atraso é calculado apenas quando o status está <b>Pendente</b>)
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <CardResumo
          titulo="Total"
          valor={totalCount}
          icone={<FaFolderOpen className="text-4xl text-blue-50" />}
          border="border-l-blue-500"
          badgeClass="bg-blue-50 text-blue-700 border-blue-200"
        />

        <CardResumo
          titulo="Pendentes"
          valor={pendentesCount}
          icone={<FaClock className="text-4xl text-yellow-50" />}
          border="border-l-yellow-500"
          badgeClass="bg-yellow-50 text-yellow-700 border-yellow-200"
        />

        <CardResumo
          titulo="Concluídas"
          valor={concluidasCount}
          icone={<FaCheckCircle className="text-4xl text-emerald-50" />}
          border="border-l-emerald-500"
          badgeClass="bg-emerald-50 text-emerald-700 border-emerald-200"
        />

        <CardResumo
          titulo="Atrasadas (SLA)"
          valor={atrasadasCount}
          icone={<FaExclamationCircle className="text-4xl text-red-50" />}
          border="border-l-red-500"
          badgeClass="bg-red-50 text-red-700 border-red-200"
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-x-auto">
        <table className="w-full text-left min-w-[1100px]">
          <thead className="bg-slate-50 text-slate-600 font-extrabold border-b text-xs md:text-sm uppercase tracking-wider select-none">
            <tr>
              <th
                className="px-4 py-4 cursor-pointer hover:bg-slate-100 transition-colors"
                onClick={() => toggleSort("created_at")}
              >
                <div className="flex items-center">
                  Data de Abertura <SortIcon colKey="created_at" />
                </div>
              </th>

              <th
                className="px-4 py-4 cursor-pointer hover:bg-slate-100 transition-colors"
                onClick={() => toggleSort("motorista_nome")}
              >
                <div className="flex items-center">
                  Motorista <SortIcon colKey="motorista_nome" />
                </div>
              </th>

              <th
                className="px-4 py-4 cursor-pointer hover:bg-slate-100 transition-colors"
                onClick={() => toggleSort("tipo_ocorrencia")}
              >
                <div className="flex items-center">
                  Ocorrência <SortIcon colKey="tipo_ocorrencia" />
                </div>
              </th>

              <th
                className="px-4 py-4 cursor-pointer hover:bg-slate-100 transition-colors"
                onClick={() => toggleSort("prioridade")}
              >
                <div className="flex items-center">
                  Prioridade <SortIcon colKey="prioridade" />
                </div>
              </th>

              <th
                className="px-4 py-4 cursor-pointer hover:bg-slate-100 transition-colors"
                onClick={() => toggleSort("status")}
              >
                <div className="flex items-center">
                  Status <SortIcon colKey="status" />
                </div>
              </th>

              <th className="px-4 py-4">Ações</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan="6" className="px-6 py-12 text-center text-slate-500">
                  Carregando...
                </td>
              </tr>
            ) : tratativasOrdenadas.length === 0 ? (
              <tr>
                <td colSpan="6" className="px-6 py-12 text-center text-slate-500">
                  Nenhuma tratativa encontrada.
                </td>
              </tr>
            ) : (
              tratativasOrdenadas.map((t) => {
                const concluida = isConcluidaOuResolvida(t?.status);

                return (
                  <tr key={t.id} className="hover:bg-blue-50/40 transition-colors">
                    <td className="px-4 py-4 text-slate-500 font-mono text-sm whitespace-nowrap">
                      {t.created_at
                        ? new Date(t.created_at).toLocaleDateString("pt-BR")
                        : "-"}
                    </td>

                    <td className="px-4 py-4">
                      <div className="font-black text-slate-900 text-sm md:text-base">
                        {t.motorista_nome || "-"}
                      </div>
                      <div className="text-xs text-slate-600 font-mono bg-slate-100 px-2 py-0.5 rounded w-fit mt-1 border border-slate-200">
                        {t.motorista_chapa || ""}
                      </div>
                    </td>

                    <td className="px-4 py-4 text-slate-700">
                      {t.tipo_ocorrencia || "-"}
                    </td>

                    <td className="px-4 py-4">{badgePrioridade(t.prioridade)}</td>

                    <td className="px-4 py-4">{badgeStatus(t)}</td>

                    <td className="px-4 py-4">
                      {concluida ? (
                        <button
                          onClick={() => navigate(`/diesel-consultar/${t.id}`)}
                          className="flex items-center gap-1.5 px-3 py-2 bg-slate-700 text-white rounded font-bold text-xs shadow-sm hover:bg-slate-800 transition-all whitespace-nowrap"
                        >
                          <FaEye size={12} /> Consultar
                        </button>
                      ) : (
                        <button
                          onClick={() => navigate(`/diesel-tratar/${t.id}`)}
                          className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded font-bold text-xs shadow-sm hover:bg-blue-700 transition-all whitespace-nowrap"
                        >
                          <FaGavel size={12} /> Tratar
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
    </div>
  );
}

function CardResumo({ titulo, valor, icone, border }) {
  return (
    <div className={`bg-white p-4 rounded-xl border shadow-sm flex items-center justify-between border-l-4 ${border}`}>
      <div>
        <p className="text-sm text-slate-500 font-bold">{titulo}</p>
        <p className="text-2xl font-black text-slate-800">{valor}</p>
      </div>
      {icone}
    </div>
  );
}
