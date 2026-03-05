// src/pages/Desempenho_Diesel_Tratativas_Central.jsx
import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
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
  FaArrowRight,
  FaEye
} from "react-icons/fa";

const VIEW = {
  OPEN_ONLY: "open_only", // Pendentes & Atrasadas
  ALL: "all", // Ver tudo
};

// SLA por prioridade (dias)
const SLA_DIAS = {
  "Gravíssima": 1,
  Gravissima: 1,
  Alta: 3,
  "Média": 7,
  Media: 7,
  Baixa: 15,
};

// Ordem de prioridade (maior urgência primeiro)
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

function statusRank(row) {
  if (isAtrasadaBySLA(row)) return 0;
  if (isPendente(row?.status)) return 1;
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

  // Botão topo
  const [viewMode, setViewMode] = useState(VIEW.OPEN_ONLY);

  // Ordenação da tabela
  const [sort, setSort] = useState({
    key: "default",
    dir: "asc",
  });

  // Contadores head:true
  const [totalCount, setTotalCount] = useState(0);
  const [pendentesCount, setPendentesCount] = useState(0);
  const [concluidasCount, setConcluidasCount] = useState(0);

  // Atrasadas por SLA (client-side)
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
    // Total
    let qTotal = supabase.from("diesel_tratativas").select("id", { count: "exact", head: true });
    qTotal = applyCommonFilters(qTotal);
    const { count: total } = await qTotal;

    // Pendentes
    let qPend = supabase.from("diesel_tratativas").select("id", { count: "exact", head: true }).ilike("status", "%pendente%");
    qPend = applyCommonFilters(qPend);
    const { count: pend } = await qPend;

    // Concluídas/Resolvidas
    let qConc = supabase.from("diesel_tratativas").select("id", { count: "exact", head: true }).or("status.ilike.%conclu%,status.ilike.%resolvid%");
    qConc = applyCommonFilters(qConc);
    const { count: conc } = await qConc;

    setTotalCount(total || 0);
    setPendentesCount(pend || 0);
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
    setFiltros({ busca: "", dataInicio: "", dataFim: "", status: "", prioridade: "" });
    setTimeout(() => aplicar(), 0);
  }

  const tratativasView = useMemo(() => {
    const rows = Array.isArray(tratativas) ? tratativas : [];
    if (viewMode === VIEW.ALL) return rows;
    return rows.filter((r) => isPendente(r?.status));
  }, [tratativas, viewMode]);

  useEffect(() => {
    const rows = Array.isArray(tratativasView) ? tratativasView : [];
    setAtrasadasCount(rows.filter((r) => isAtrasadaBySLA(r)).length);
  }, [tratativasView]);

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
    if (sort.key !== colKey || sort.key === "default") return <FaSort className="inline ml-1 text-slate-300" />;
    return sort.dir === "asc" ? <FaSortUp className="inline ml-1 text-blue-500" /> : <FaSortDown className="inline ml-1 text-blue-500" />;
  }

  function badgePrioridade(p) {
    const v = norm(p);
    const base = "px-2.5 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider shadow-sm";
    if (v === "Gravíssima" || v === "Gravissima") return <span className={`${base} bg-rose-600 text-white`}>Gravíssima</span>;
    if (v === "Alta") return <span className={`${base} bg-orange-500 text-white`}>Alta</span>;
    if (v === "Média" || v === "Media") return <span className={`${base} bg-amber-400 text-amber-900`}>Média</span>;
    if (v === "Baixa") return <span className={`${base} bg-emerald-500 text-white`}>Baixa</span>;
    return <span className={`${base} bg-slate-200 text-slate-700`}>{v || "-"}</span>;
  }

  function badgeStatus(row) {
    const st = norm(row?.status).toLowerCase();
    const atrasada = isAtrasadaBySLA(row);

    const base = "px-2.5 py-1 rounded-lg text-xs font-bold flex items-center w-fit gap-1.5 shadow-sm border";

    if (atrasada) {
      return (
        <span className={`${base} bg-rose-50 text-rose-700 border-rose-200`}>
          <FaExclamationCircle /> Atrasada
        </span>
      );
    }
    if (st.includes("pendente")) {
      return (
        <span className={`${base} bg-amber-50 text-amber-700 border-amber-200`}>
          <FaClock /> Pendente
        </span>
      );
    }
    if (st.includes("resolvido") || st.includes("conclu")) {
      return (
        <span className={`${base} bg-emerald-50 text-emerald-700 border-emerald-200`}>
          <FaCheckCircle /> Resolvida
        </span>
      );
    }
    return (
      <span className={`${base} bg-slate-100 text-slate-700 border-slate-200`}>
        {row?.status || "-"}
      </span>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 font-sans bg-slate-50 min-h-screen">
      
      {/* HEADER DA PÁGINA */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-100 text-rose-800 text-xs font-black uppercase tracking-widest mb-3 shadow-sm border border-rose-200">
            <FaGavel /> Desempenho Diesel
          </div>
          <h1 className="text-3xl font-black text-slate-900">
            Central de Tratativas
          </h1>
          <p className="text-sm font-medium text-slate-500 mt-1">
            Gestão de medidas disciplinares e reorientações de KM/L.
          </p>
        </div>

        {/* VIEW MODE TOGGLE */}
        <div className="flex bg-slate-200 p-1.5 rounded-2xl w-fit shadow-inner">
          <button
            onClick={() => setViewMode(VIEW.OPEN_ONLY)}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
              viewMode === VIEW.OPEN_ONLY ? "bg-white text-rose-700 shadow-md" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <FaClock /> Pendentes & Atrasadas
          </button>
          <button
            onClick={() => setViewMode(VIEW.ALL)}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
              viewMode === VIEW.ALL ? "bg-white text-slate-800 shadow-md" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <FaFolderOpen /> Ver Histórico Completo
          </button>
        </div>
      </div>

      {/* CARDS DE RESUMO (KPIs) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <CardResumo icone={<FaFolderOpen/>} titulo="Total de Ocorrências" valor={totalCount} cor="blue" />
        <CardResumo icone={<FaClock/>} titulo="Aguardando Ação" valor={pendentesCount} cor="amber" />
        <CardResumo icone={<FaExclamationCircle/>} titulo="Atrasadas (Fora do SLA)" valor={atrasadasCount} cor="rose" />
        <CardResumo icone={<FaCheckCircle/>} titulo="Tratativas Concluídas" valor={concluidasCount} cor="emerald" />
      </div>

      {/* FILTROS */}
      <div className="bg-white rounded-[1.5rem] border border-slate-200 shadow-sm p-6 mb-8">
        <h2 className="text-sm font-black text-slate-800 mb-4 flex items-center gap-2 uppercase tracking-wide">
          <FaFilter className="text-slate-400" /> Filtros de Busca
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="relative">
            <FaSearch className="absolute left-3.5 top-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar motorista, chapa, motivo..."
              value={filtros.busca}
              onChange={(e) => setFiltros({ ...filtros, busca: e.target.value })}
              className="w-full pl-10 pr-3 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:border-blue-500 outline-none transition-colors"
            />
          </div>

          <input
            type="date"
            value={filtros.dataInicio}
            onChange={(e) => setFiltros({ ...filtros, dataInicio: e.target.value })}
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:border-blue-500 outline-none text-slate-600 transition-colors"
          />

          <input
            type="date"
            value={filtros.dataFim}
            onChange={(e) => setFiltros({ ...filtros, dataFim: e.target.value })}
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:border-blue-500 outline-none text-slate-600 transition-colors"
          />

          <select
            value={filtros.prioridade}
            onChange={(e) => setFiltros({ ...filtros, prioridade: e.target.value })}
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:border-blue-500 outline-none appearance-none cursor-pointer transition-colors"
          >
            <option value="">Todas Prioridades</option>
            <option value="Gravíssima">Gravíssima</option>
            <option value="Alta">Alta</option>
            <option value="Média">Média</option>
            <option value="Baixa">Baixa</option>
          </select>

          <select
            value={filtros.status}
            onChange={(e) => setFiltros({ ...filtros, status: e.target.value })}
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:border-blue-500 outline-none appearance-none cursor-pointer transition-colors"
          >
            <option value="">Qualquer Status</option>
            <option value="Pendente">Pendente</option>
            <option value="Resolvido">Resolvido</option>
            <option value="Concluída">Concluída</option>
          </select>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between mt-6 pt-4 border-t border-slate-100 gap-4">
          <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 px-3 py-2 rounded-lg border border-slate-200">
            <span>SLA:</span>
            <span className="text-rose-600">Gravíssima 1D</span> • 
            <span className="text-orange-500">Alta 3D</span> • 
            <span className="text-amber-600">Média 7D</span> • 
            <span className="text-emerald-500">Baixa 15D</span>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button onClick={limparFiltros} className="px-6 py-3 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-100 transition-colors w-full sm:w-auto">
              Limpar
            </button>
            <button onClick={aplicar} disabled={loading} className="px-8 py-3 rounded-xl text-sm font-black bg-blue-600 text-white shadow-lg hover:bg-blue-700 hover:shadow-blue-500/30 transition-all disabled:opacity-60 disabled:hover:shadow-none w-full sm:w-auto flex justify-center items-center gap-2">
              {loading ? "Buscando..." : <><FaSearch /> Filtrar Registros</>}
            </button>
          </div>
        </div>
      </div>

      {/* TABELA PRINCIPAL */}
      <div className="bg-white rounded-[1.5rem] shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[900px]">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs font-black text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="py-4 px-6 cursor-pointer hover:bg-slate-100 transition-colors select-none" onClick={() => toggleSort("created_at")}>
                  Data de Abertura <SortIcon colKey="created_at" />
                </th>
                <th className="py-4 px-6 cursor-pointer hover:bg-slate-100 transition-colors select-none" onClick={() => toggleSort("motorista_nome")}>
                  Motorista Infrator <SortIcon colKey="motorista_nome" />
                </th>
                <th className="py-4 px-6 cursor-pointer hover:bg-slate-100 transition-colors select-none" onClick={() => toggleSort("tipo_ocorrencia")}>
                  Ocorrência <SortIcon colKey="tipo_ocorrencia" />
                </th>
                <th className="py-4 px-6 cursor-pointer hover:bg-slate-100 transition-colors select-none" onClick={() => toggleSort("prioridade")}>
                  SLA / Prioridade <SortIcon colKey="prioridade" />
                </th>
                <th className="py-4 px-6 cursor-pointer hover:bg-slate-100 transition-colors select-none" onClick={() => toggleSort("status")}>
                  Status Atual <SortIcon colKey="status" />
                </th>
                <th className="py-4 px-6 text-center">Ações</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="6" className="text-center py-12 text-slate-400 font-bold text-sm">
                    Carregando registros...
                  </td>
                </tr>
              ) : tratativasOrdenadas.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center py-12 text-slate-400 font-bold text-sm">
                    Nenhuma tratativa encontrada com os filtros atuais.
                  </td>
                </tr>
              ) : (
                tratativasOrdenadas.map((t) => {
                  const concluida = isConcluidaOuResolvida(t?.status);
                  
                  return (
                    <tr key={t.id} className="hover:bg-slate-50/80 transition-colors group">
                      <td className="py-4 px-6 text-sm font-mono text-slate-500">
                        {t.created_at ? new Date(t.created_at).toLocaleDateString("pt-BR") : "-"}
                      </td>

                      <td className="py-4 px-6">
                        <div className="font-bold text-slate-800 text-sm">{t.motorista_nome || "-"}</div>
                        <div className="text-xs font-mono text-slate-400 mt-0.5 bg-slate-100 w-fit px-1.5 py-0.5 rounded">{t.motorista_chapa || "-"}</div>
                      </td>
                      
                      <td className="py-4 px-6">
                        <div className="text-sm font-semibold text-slate-700">{t.tipo_ocorrencia || "-"}</div>
                      </td>

                      <td className="py-4 px-6">
                        {badgePrioridade(t.prioridade)}
                      </td>

                      <td className="py-4 px-6">
                        {badgeStatus(t)}
                      </td>

                      <td className="py-4 px-6 text-center">
                        {concluida ? (
                          <button
                            onClick={() => navigate(`/diesel-consultar/${t.id}`)}
                            className="inline-flex items-center justify-center gap-1.5 bg-white border-2 border-slate-200 text-slate-600 px-4 py-2 rounded-xl hover:bg-slate-50 hover:border-slate-300 hover:text-slate-800 text-xs font-bold shadow-sm transition-all"
                          >
                            <FaEye /> Consultar
                          </button>
                        ) : (
                          <button
                            onClick={() => navigate(`/diesel-tratar/${t.id}`)}
                            className="inline-flex items-center justify-center gap-1.5 bg-rose-600 text-white px-4 py-2 rounded-xl hover:bg-rose-700 text-xs font-black shadow-md hover:shadow-rose-600/30 transition-all transform hover:scale-105"
                          >
                            <FaGavel /> Analisar & Tratar
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
    </div>
  );
}

// Componente para os Cards de KPI
function CardResumo({ titulo, valor, cor, icone }) {
  const coresMap = {
    blue: "bg-blue-50 border-blue-200 text-blue-700 icon-blue-500",
    amber: "bg-amber-50 border-amber-200 text-amber-700 icon-amber-500",
    rose: "bg-rose-50 border-rose-200 text-rose-700 icon-rose-500",
    emerald: "bg-emerald-50 border-emerald-200 text-emerald-700 icon-emerald-500"
  };

  const c = coresMap[cor] || coresMap.blue;
  const textColor = c.split(" ")[2];
  const iconColor = c.split(" ")[3].replace("icon-", "text-");

  return (
    <div className={`rounded-2xl border-2 p-6 shadow-sm flex flex-col justify-between ${c.split(" ").slice(0,2).join(" ")} transition-all hover:scale-[1.02] cursor-default`}>
      <div className="flex items-start justify-between mb-4">
        <h3 className={`text-xs font-black uppercase tracking-widest ${textColor} opacity-80 leading-tight w-2/3`}>{titulo}</h3>
        <div className={`text-2xl ${iconColor} bg-white p-2 rounded-xl shadow-sm`}>{icone}</div>
      </div>
      <p className={`text-4xl font-black ${textColor}`}>{valor}</p>
    </div>
  );
}
