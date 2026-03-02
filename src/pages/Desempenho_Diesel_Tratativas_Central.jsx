// src/pages/Desempenho_Diesel_Tratativas_Central.jsx
// Central Diesel (módulo separado)
// - Replica do CentralTratativas (disciplina) trocando:
//   tratativas -> diesel_tratativas
//   tratativas_detalhes -> diesel_tratativas_detalhes
// - Mantém: SLA por prioridade, viewMode, contadores head, ordenação client-side

import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase";

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
    setor: "",
    status: "",
    prioridade: "",
  });
  const [loading, setLoading] = useState(false);

  // Setores dinâmicos (mesma lógica do disciplina)
  const [setores, setSetores] = useState([]);

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
        `motorista_nome.ilike.%${f.busca}%,motorista_chapa.ilike.%${f.busca}%,descricao.ilike.%${f.busca}%`
      );
    }

    if (f.setor) query = query.eq("setor_origem", f.setor);
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

  async function carregarSetoresFiltro() {
    try {
      const { data: setoresData, error: eSet } = await supabase
        .from("setores")
        .select("nome")
        .order("nome", { ascending: true });

      if (!eSet && Array.isArray(setoresData) && setoresData.length > 0) {
        const lista = setoresData
          .map((s) => String(s?.nome || "").trim())
          .filter(Boolean);
        setSetores(Array.from(new Set(lista)));
        return;
      }

      // fallback: setores presentes na tabela diesel_tratativas
      const { data: trat, error: eTrat } = await supabase
        .from("diesel_tratativas")
        .select("setor_origem")
        .not("setor_origem", "is", null)
        .limit(10000);

      if (eTrat) throw eTrat;

      const lista2 = (trat || [])
        .map((r) => String(r?.setor_origem || "").trim())
        .filter(Boolean);

      setSetores(Array.from(new Set(lista2)).sort((a, b) => a.localeCompare(b)));
    } catch (err) {
      console.error("Erro carregando setores do filtro (diesel):", err);
      setSetores([]);
    }
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
    let qTotal = supabase
      .from("diesel_tratativas")
      .select("id", { count: "exact", head: true });
    qTotal = applyCommonFilters(qTotal);
    const { count: total } = await qTotal;

    // Pendentes
    let qPend = supabase
      .from("diesel_tratativas")
      .select("id", { count: "exact", head: true })
      .ilike("status", "%pendente%");
    qPend = applyCommonFilters(qPend);
    const { count: pend } = await qPend;

    // Concluídas/Resolvidas
    let qConc = supabase
      .from("diesel_tratativas")
      .select("id", { count: "exact", head: true })
      .or("status.ilike.%conclu%,status.ilike.%resolvid%");
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
    carregarSetoresFiltro();
    aplicar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function limparFiltros() {
    setFiltros({
      busca: "",
      dataInicio: "",
      dataFim: "",
      setor: "",
      status: "",
      prioridade: "",
    });
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
      if (sort.key === "setor_origem") {
        return stringComparator((x) => x?.setor_origem, sort.dir, a, b);
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
    if (sort.key !== colKey) return <span className="ml-1 text-white/70">↕</span>;
    if (sort.key === "default") return <span className="ml-1 text-white/70">↕</span>;
    return <span className="ml-1">{sort.dir === "asc" ? "↑" : "↓"}</span>;
  }

  function badgePrioridade(p) {
    const v = norm(p);
    const base = "px-2 py-1 rounded text-xs font-medium";
    if (v === "Gravíssima" || v === "Gravissima")
      return <span className={`${base} bg-red-100 text-red-800`}>Gravíssima</span>;
    if (v === "Alta") return <span className={`${base} bg-orange-100 text-orange-800`}>Alta</span>;
    if (v === "Média" || v === "Media")
      return <span className={`${base} bg-yellow-100 text-yellow-800`}>Média</span>;
    if (v === "Baixa") return <span className={`${base} bg-green-100 text-green-800`}>Baixa</span>;
    return <span className={`${base} bg-gray-100 text-gray-700`}>{v || "-"}</span>;
  }

  function badgeStatus(row) {
    const st = norm(row?.status).toLowerCase();
    const atrasada = isAtrasadaBySLA(row);

    if (atrasada) {
      return (
        <span className="px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-800">
          Atraso
        </span>
      );
    }
    if (st.includes("pendente")) {
      return (
        <span className="px-2 py-1 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
          Pendente
        </span>
      );
    }
    if (st.includes("resolvido") || st.includes("conclu")) {
      return (
        <span className="px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800">
          Resolvido
        </span>
      );
    }
    return (
      <span className="px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-700">
        {row?.status || "-"}
      </span>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h1 className="text-2xl font-bold text-gray-700">Tratativas Diesel</h1>

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

      {/* Filtros */}
      <div className="bg-white shadow rounded-lg p-4 mb-6">
        <h2 className="text-lg font-semibold mb-3">Filtros</h2>

        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <input
            type="text"
            placeholder="Buscar (nome, chapa, descrição...)"
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
            {setores.map((nome) => (
              <option key={nome} value={nome}>
                {nome}
              </option>
            ))}
          </select>

          <select
            value={filtros.prioridade}
            onChange={(e) => setFiltros({ ...filtros, prioridade: e.target.value })}
            className="border rounded-md px-3 py-2 bg-white"
          >
            <option value="">Todas as Prioridades</option>
            <option value="Gravíssima">Gravíssima</option>
            <option value="Alta">Alta</option>
            <option value="Média">Média</option>
            <option value="Baixa">Baixa</option>
          </select>

          <select
            value={filtros.status}
            onChange={(e) => setFiltros({ ...filtros, status: e.target.value })}
            className="border rounded-md px-3 py-2 bg-white"
          >
            <option value="">Todos os Status</option>
            <option value="Pendente">Pendente</option>
            <option value="Resolvido">Resolvido</option>
            <option value="Concluída">Concluída</option>
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

        <div className="mt-4">
          <div className="text-xs text-gray-500">
            Ordenação padrão: <b>Prioridade</b> → <b>Status</b> → <b>Mais recentes</b>. Clique no
            cabeçalho para ordenar; clique novamente para inverter; terceira vez volta ao padrão.
          </div>

          <div className="mt-2 rounded-lg border bg-gray-50 px-3 py-2">
            <div className="text-xs font-semibold text-gray-700">
              Regra de SLA para considerar como <span className="text-red-700">ATRASO</span>
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-700">
              <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-800 font-medium">
                Gravíssima: 1 dia
              </span>
              <span className="px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 font-medium">
                Alta: 3 dias
              </span>
              <span className="px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800 font-medium">
                Média: 7 dias
              </span>
              <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-800 font-medium">
                Baixa: 15 dias
              </span>

              <span className="text-gray-500 ml-1">
                (Atraso só quando status está <b>Pendente</b>)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <CardResumo titulo="Total" valor={totalCount} cor="bg-blue-100 text-blue-700" />
        <CardResumo titulo="Pendentes" valor={pendentesCount} cor="bg-yellow-100 text-yellow-700" />
        <CardResumo titulo="Concluídas" valor={concluidasCount} cor="bg-green-100 text-green-700" />
        <CardResumo titulo="Atrasadas (SLA)" valor={atrasadasCount} cor="bg-red-100 text-red-700" />
      </div>

      {/* Lista */}
      <div className="bg-white shadow rounded-lg overflow-x-auto">
        <table className="min-w-full">
          <thead className="bg-blue-600 text-white">
            <tr>
              <th className="py-2 px-3 text-left cursor-pointer select-none" onClick={() => toggleSort("created_at")}>
                Data de Abertura <SortIcon colKey="created_at" />
              </th>

              <th className="py-2 px-3 text-left cursor-pointer select-none" onClick={() => toggleSort("motorista_nome")}>
                Motorista <SortIcon colKey="motorista_nome" />
              </th>

              <th className="py-2 px-3 text-left cursor-pointer select-none" onClick={() => toggleSort("tipo_ocorrencia")}>
                Ocorrência <SortIcon colKey="tipo_ocorrencia" />
              </th>

              <th className="py-2 px-3 text-left cursor-pointer select-none" onClick={() => toggleSort("prioridade")}>
                Prioridade <SortIcon colKey="prioridade" />
              </th>

              <th className="py-2 px-3 text-left cursor-pointer select-none" onClick={() => toggleSort("setor_origem")}>
                Setor <SortIcon colKey="setor_origem" />
              </th>

              <th className="py-2 px-3 text-left cursor-pointer select-none" onClick={() => toggleSort("status")}>
                Status <SortIcon colKey="status" />
              </th>

              <th className="py-2 px-3 text-left">Ações</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan="7" className="text-center p-4 text-gray-500">
                  Carregando...
                </td>
              </tr>
            ) : tratativasOrdenadas.length === 0 ? (
              <tr>
                <td colSpan="7" className="text-center p-4 text-gray-500">
                  Nenhuma tratativa encontrada.
                </td>
              </tr>
            ) : (
              tratativasOrdenadas.map((t) => {
                const concluida = isConcluidaOuResolvida(t?.status);
                return (
                  <tr key={t.id} className="border-t hover:bg-gray-50">
                    <td className="py-2 px-3 text-gray-600">
                      {t.created_at ? new Date(t.created_at).toLocaleDateString("pt-BR") : "-"}
                    </td>

                    <td className="py-2 px-3 text-gray-700">{t.motorista_nome || "-"}</td>
                    <td className="py-2 px-3 text-gray-700">{t.tipo_ocorrencia || "-"}</td>

                    <td className="py-2 px-3">{badgePrioridade(t.prioridade)}</td>

                    <td className="py-2 px-3 text-gray-700">{t.setor_origem || "-"}</td>

                    <td className="py-2 px-3">{badgeStatus(t)}</td>

                    <td className="py-2 px-3">
                      {concluida ? (
                        <button
                          onClick={() => navigate(`/diesel/consultar/${t.id}`)}
                          className="bg-gray-500 text-white px-3 py-1 rounded-md hover:bg-gray-600 text-sm"
                        >
                          Consultar
                        </button>
                      ) : (
                        <button
                          onClick={() => navigate(`/diesel/tratar/${t.id}`)}
                          className="bg-blue-600 text-white px-3 py-1 rounded-md hover:bg-blue-700 text-sm"
                        >
                          Tratar
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

function CardResumo({ titulo, valor, cor }) {
  return (
    <div className={`${cor} rounded-lg shadow p-5 text-center`}>
      <h3 className="text-sm font-medium text-gray-600">{titulo}</h3>
      <p className="text-3xl font-bold mt-2 text-gray-800">{valor}</p>
    </div>
  );
}
