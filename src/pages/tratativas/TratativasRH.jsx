// src/pages/TratativasRH.jsx
import React, { useEffect, useMemo, useState, useContext } from "react";
import { supabase } from "../../supabase";
import { AuthContext } from "../../context/AuthContext";

import TratativasLancarRH from "./TratativasLancarRH";
import TratativasConsultarRH from "./TratativasConsultarRH";

const ACOES_RH = new Set(["Advertência", "Suspensão"]);

const VIEW = {
  OPEN_ONLY: "open_only", // Pendentes RH
  ALL: "all", // Ver tudo
};

/* =========================
   Helpers
========================= */
function norm(s) {
  return String(s || "").trim().toLowerCase();
}

function brDateTime(d) {
  if (!d) return "—";
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleString("pt-BR");
}

function fileNameFromUrl(u) {
  try {
    const raw = String(u || "");
    const noHash = raw.split("#")[0];
    const noQuery = noHash.split("?")[0];
    const last = noQuery.split("/").filter(Boolean).pop() || "";
    return decodeURIComponent(last || "");
  } catch {
    return "";
  }
}

function tailAfterSecondUnderscore(filename) {
  const name = String(filename || "").trim();
  if (!name) return "";
  const parts = name.split("_").filter(Boolean);
  if (parts.length >= 3) return parts.slice(2).join("_");
  return name;
}

function getConsolidationFileKey(evidUrl, anexoUrl) {
  const legacy = tailAfterSecondUnderscore(fileNameFromUrl(evidUrl));
  const oficial = tailAfterSecondUnderscore(fileNameFromUrl(anexoUrl));
  if (oficial) return oficial;
  if (legacy) return legacy;
  return "SEM_EVIDENCIA";
}

function BadgeAcao({ acao }) {
  const isSusp = acao === "Suspensão";
  return (
    <span
      className={[
        "inline-flex rounded-full px-2 py-1 text-xs font-semibold",
        isSusp ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-800",
      ].join(" ")}
    >
      {acao || "—"}
    </span>
  );
}

function StatusPill({ lancado }) {
  return lancado ? (
    <span className="px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800">
      Concluída
    </span>
  ) : (
    <span className="px-2 py-1 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
      Pendente
    </span>
  );
}

function CardResumo({ titulo, valor, cor }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className={`inline-flex rounded-full px-3 py-1 text-xs font-black uppercase tracking-wide ${cor}`}>
        {titulo}
      </div>
      <p className="mt-4 text-3xl font-black text-slate-900">{valor}</p>
    </div>
  );
}

export default function TratativasRH() {
  useContext(AuthContext);

  // ✅ Filtros: Regra de data fixa 03/02/2026
  const [filtros, setFiltros] = useState({
    busca: "",
    status: "",
    acao: "",
    dataInicio: "2026-02-03", 
    dataFim: "",
  });

  const [loading, setLoading] = useState(false);
  const [grupos, setGrupos] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [grupoSel, setGrupoSel] = useState(null);

  const [viewMode, setViewMode] = useState(VIEW.OPEN_ONLY);

  const [sort, setSort] = useState({
    key: "default",
    dir: "asc",
  });

  async function load() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("tratativas_detalhes")
        .select(
          `
          id, created_at, tratativa_id, acao_aplicada, observacoes, imagem_tratativa, anexo_tratativa, 
          tratado_por_login, tratado_por_nome,
          tratativas:tratativa_id (
            id, created_at, status, motorista_nome, motorista_chapa, tipo_ocorrencia,
            prioridade, setor_origem, linha, descricao, data_ocorrido, hora_ocorrido
          )
        `
        )
        .in("acao_aplicada", Array.from(ACOES_RH))
        .order("created_at", { ascending: false })
        .limit(5000);

      if (error) throw error;

      const detalhes = (data || []).filter((d) => d?.tratativas?.id);
      const tratativaIds = Array.from(new Set(detalhes.map((d) => d.tratativa_id))).filter(Boolean);

      const rhMap = new Map();
      if (tratativaIds.length > 0) {
        const { data: rh, error: erh } = await supabase
          .from("tratativas_rh")
          .select("id, tratativa_id, status_rh, lancado_transnet, evidencia_transnet_url, observacao_rh, lancado_em, created_at")
          .in("tratativa_id", tratativaIds);

        if (erh) throw erh;
        (rh || []).forEach((r) => rhMap.set(r.tratativa_id, r));
      }

      const groupsMap = new Map();

      for (const d of detalhes) {
        const t = d.tratativas;
        const rh = rhMap.get(d.tratativa_id) || null;
        const fileKey = getConsolidationFileKey(d.imagem_tratativa, d.anexo_tratativa);

        const motoristaChapa = String(t?.motorista_chapa || "").trim();
        const acao = d.acao_aplicada || "—";
        const key = `${motoristaChapa}||${acao}||${fileKey}`;

        const rhLancado =
          Boolean(rh?.lancado_transnet) ||
          String(rh?.status_rh || "").toUpperCase().includes("CONCL");

        if (!groupsMap.has(key)) {
          groupsMap.set(key, {
            key,
            motorista_nome: t?.motorista_nome || "",
            motorista_chapa: motoristaChapa || "",
            acao_aplicada: acao,
            arquivo_key: fileKey,
            qtd_tratativas: 0,
            ultima_data: d.created_at || t?.created_at || null,
            evidencia_conclusao_urls: new Set(),
            anexo_tratador_urls: new Set(),
            rh_lancado: rhLancado,
            rh_obs: rh?.observacao_rh || "",
            rh_evid_url: rh?.evidencia_transnet_url || null,
            rh_lancado_em: rh?.lancado_em || null,
            tratativa_ids: new Set(),
            itens: [],
          });
        }

        const g = groupsMap.get(key);
        g.qtd_tratativas += 1;
        g.tratativa_ids.add(d.tratativa_id);

        const currentDate = d.created_at || t?.created_at || null;
        if (currentDate && (!g.ultima_data || new Date(currentDate) > new Date(g.ultima_data))) {
          g.ultima_data = currentDate;
        }

        if (d.imagem_tratativa) g.evidencia_conclusao_urls.add(d.imagem_tratativa);
        if (d.anexo_tratativa) g.anexo_tratador_urls.add(d.anexo_tratativa);

        if (rhLancado) {
          g.rh_lancado = true;
          if (rh?.observacao_rh) g.rh_obs = rh.observacao_rh;
          if (rh?.evidencia_transnet_url) g.rh_evid_url = rh.evidencia_transnet_url;
          if (rh?.lancado_em) g.rh_lancado_em = rh.lancado_em;
        }

        g.itens.push({
          detalhe_id: d.id,
          detalhe_created_at: d.created_at,
          tratativa_id: d.tratativa_id,
          tipo_ocorrencia: t?.tipo_ocorrencia || "",
          linha: t?.linha || "",
          prioridade: t?.prioridade || "",
          setor_origem: t?.setor_origem || "",
          data_ocorrido: t?.data_ocorrido || null,
          hora_ocorrido: t?.hora_ocorrido || "",
          observacoes_tratador: d.observacoes || "",
          tratado_por_nome: d.tratado_por_nome || d.tratado_por_login || "—",
          evidencia_conclusao_url: d.imagem_tratativa || null,
          anexo_tratador_url: d.anexo_tratativa || null,
        });
      }

      const mergedGroups = Array.from(groupsMap.values()).map((g) => ({
        ...g,
        evidencia_conclusao_urls: Array.from(g.evidencia_conclusao_urls),
        anexo_tratador_urls: Array.from(g.anexo_tratador_urls),
        tratativa_ids: Array.from(g.tratativa_ids),
        itens: (g.itens || []).sort((a, b) => new Date(b.detalhe_created_at) - new Date(a.detalhe_created_at)),
      }));

      mergedGroups.sort((a, b) => new Date(b.ultima_data || 0) - new Date(a.ultima_data || 0));
      setGrupos(mergedGroups);
    } catch (e) {
      alert(`Erro ao carregar RH: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = norm(filtros.busca);
    const di = filtros.dataInicio ? new Date(filtros.dataInicio) : null;
    const df = filtros.dataFim ? new Date(filtros.dataFim) : null;

    if (df) {
      df.setDate(df.getDate() + 1);
      df.setMilliseconds(-1);
    }

    let list = grupos;
    if (viewMode === VIEW.OPEN_ONLY) {
      list = list.filter((g) => !g.rh_lancado);
    }

    return list.filter((g) => {
      if (filtros.status === "PENDENTE" && g.rh_lancado) return false;
      if (filtros.status === "CONCLUIDA" && !g.rh_lancado) return false;
      if (filtros.acao && g.acao_aplicada !== filtros.acao) return false;

      if (g.ultima_data) {
        const dt = new Date(g.ultima_data);
        if (di && dt < di) return false;
        if (df && dt > df) return false;
      }

      if (!q) return true;
      const blob = norm(
        [
          g.motorista_nome,
          g.motorista_chapa,
          g.acao_aplicada,
          g.arquivo_key,
          ...(g.itens || []).map((i) => i.tipo_ocorrencia),
          ...(g.itens || []).map((i) => i.linha),
          ...(g.itens || []).map((i) => i.setor_origem),
        ]
          .filter(Boolean)
          .join(" ")
      );
      return blob.includes(q);
    });
  }, [grupos, filtros, viewMode]);

  const sortedGroups = useMemo(() => {
    const rows = [...filtered];
    if (sort.key === "default") {
        return rows.sort((a, b) => new Date(b.ultima_data || 0) - new Date(a.ultima_data || 0));
    }
    rows.sort((a, b) => {
        if (sort.key === "ultima_data") {
            const da = a.ultima_data ? new Date(a.ultima_data).getTime() : 0;
            const db = b.ultima_data ? new Date(b.ultima_data).getTime() : 0;
            const r = da - db;
            return sort.dir === "asc" ? r : -r;
        }
        if (sort.key === "motorista_nome") {
            const va = norm(a.motorista_nome);
            const vb = norm(b.motorista_nome);
            const r = va.localeCompare(vb, "pt-BR");
            return sort.dir === "asc" ? r : -r;
        }
        if (sort.key === "motorista_chapa") {
            const va = norm(a.motorista_chapa);
            const vb = norm(b.motorista_chapa);
            const r = va.localeCompare(vb, "pt-BR");
            return sort.dir === "asc" ? r : -r;
        }
        if (sort.key === "acao_aplicada") {
            const va = norm(a.acao_aplicada);
            const vb = norm(b.acao_aplicada);
            const r = va.localeCompare(vb, "pt-BR");
            return sort.dir === "asc" ? r : -r;
        }
        if (sort.key === "qtd_tratativas") {
            const r = (a.qtd_tratativas || 0) - (b.qtd_tratativas || 0);
            return sort.dir === "asc" ? r : -r;
        }
        if (sort.key === "status") {
            const sa = a.rh_lancado ? 1 : 0;
            const sb = b.rh_lancado ? 1 : 0;
            const r = sa - sb;
            return sort.dir === "asc" ? r : -r;
        }
        return 0;
    });
    return rows;
  }, [filtered, sort]);

  function toggleSort(key) {
    setSort((prev) => {
      if (prev.key !== key) return { key, dir: "asc" };
      if (prev.dir === "asc") return { key, dir: "desc" };
      return { key: "default", dir: "asc" };
    });
  }

  function SortIcon({ colKey }) {
    if (sort.key !== colKey || sort.key === "default") return <span className="ml-1 text-white/70">↕</span>;
    return <span className="ml-1">{sort.dir === "asc" ? "↑" : "↓"}</span>;
  }

  const counts = useMemo(() => {
    let pend = 0; let concl = 0; let adv = 0; let susp = 0;
    sortedGroups.forEach((g) => {
      if (g.rh_lancado) concl += 1; else pend += 1;
      if (g.acao_aplicada === "Advertência") adv += 1;
      if (g.acao_aplicada === "Suspensão") susp += 1;
    });
    return { pend, concl, adv, susp, total: sortedGroups.length };
  }, [sortedGroups]);

  // ✅ Limpar filtros voltando para a regra de 03/02/2026
  function limparFiltros() {
    setFiltros({
      busca: "",
      status: "",
      acao: "",
      dataInicio: "2026-02-03",
      dataFim: "",
    });
  }

  function openGroup(g) {
    setGrupoSel(g);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setGrupoSel(null);
  }

  return (
    <div className="min-h-screen space-y-5 bg-slate-50 p-4 md:p-6 text-slate-800">
      <div className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.24em] text-violet-600">
            Tratativas
          </div>
          <h1 className="mt-3 text-3xl font-black text-slate-900">Tratativas RH</h1>
          <p className="mt-2 text-sm text-slate-600">
            Consolide advertencias e suspensoes do fluxo de tratativas no mesmo padrao visual das centrais.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode(VIEW.ALL)}
            className={["rounded-full px-4 py-2 text-xs font-black uppercase tracking-wide transition", viewMode === VIEW.ALL ? "bg-slate-900 text-white shadow-sm" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"].join(" ")}
          >
            VER TUDO
          </button>
          <button
            onClick={() => setViewMode(VIEW.OPEN_ONLY)}
            className={["rounded-full px-4 py-2 text-xs font-black uppercase tracking-wide transition", viewMode === VIEW.OPEN_ONLY ? "bg-violet-600 text-white shadow-sm" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"].join(" ")}
          >
            PENDENTES DO RH
          </button>
        </div>
      </div>

      <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <h2 className="text-lg font-black text-slate-900">Filtros do RH</h2>
          <p className="text-sm text-slate-500">
            Refine por texto, periodo, status e acao para localizar rapidamente o que ainda depende do RH.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <input
            type="text"
            placeholder="Buscar..."
            value={filtros.busca}
            onChange={(e) => setFiltros({ ...filtros, busca: e.target.value })}
            className="col-span-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-medium text-slate-700 outline-none transition focus:border-violet-400 focus:bg-white"
          />
          <input
            type="date"
            value={filtros.dataInicio}
            onChange={(e) => setFiltros({ ...filtros, dataInicio: e.target.value })}
            className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-medium text-slate-700 outline-none transition focus:border-violet-400 focus:bg-white"
          />
          <input
            type="date"
            value={filtros.dataFim}
            onChange={(e) => setFiltros({ ...filtros, dataFim: e.target.value })}
            className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-medium text-slate-700 outline-none transition focus:border-violet-400 focus:bg-white"
          />
          <select
            value={filtros.status}
            onChange={(e) => setFiltros({ ...filtros, status: e.target.value })}
            className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-medium text-slate-700 outline-none transition focus:border-violet-400 focus:bg-white"
          >
            <option value="">Status</option>
            <option value="PENDENTE">Pendentes</option>
            <option value="CONCLUIDA">Concluídas</option>
          </select>
          <select
            value={filtros.acao}
            onChange={(e) => setFiltros({ ...filtros, acao: e.target.value })}
            className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-medium text-slate-700 outline-none transition focus:border-violet-400 focus:bg-white"
          >
            <option value="">Ação</option>
            <option value="Advertência">Advertência</option>
            <option value="Suspensão">Suspensão</option>
          </select>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <div className="text-sm text-slate-600">
            {loading ? "Carregando..." : `${sortedGroups.length} registros (Filtrados)`}
          </div>
          <div className="flex gap-2">
            <button onClick={limparFiltros} className="rounded-2xl border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-200">Limpar</button>
            <button onClick={load} disabled={loading} className="rounded-2xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-violet-700 disabled:bg-slate-400">
              {loading ? "Atualizando..." : "Atualizar"}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
        <CardResumo titulo="Total na Tela" valor={counts.total} cor="bg-blue-100 text-blue-700" />
        <CardResumo titulo="Pendentes RH" valor={counts.pend} cor="bg-yellow-100 text-yellow-700" />
        <CardResumo titulo="Concluídas RH" valor={counts.concl} cor="bg-green-100 text-green-700" />
        <CardResumo titulo="Advertências" valor={counts.adv} cor="bg-yellow-50 text-yellow-700" />
        <CardResumo titulo="Suspensões" valor={counts.susp} cor="bg-red-50 text-red-700" />
      </div>

      <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-4 text-left text-xs font-black uppercase tracking-[0.18em] cursor-pointer select-none" onClick={() => toggleSort("ultima_data")}>Data <SortIcon colKey="ultima_data" /></th>
              <th className="px-4 py-4 text-left text-xs font-black uppercase tracking-[0.18em] cursor-pointer select-none" onClick={() => toggleSort("motorista_nome")}>Motorista <SortIcon colKey="motorista_nome" /></th>
              <th className="px-4 py-4 text-left text-xs font-black uppercase tracking-[0.18em] cursor-pointer select-none" onClick={() => toggleSort("motorista_chapa")}>Chapa <SortIcon colKey="motorista_chapa" /></th>
              <th className="px-4 py-4 text-left text-xs font-black uppercase tracking-[0.18em] cursor-pointer select-none" onClick={() => toggleSort("acao_aplicada")}>Ação <SortIcon colKey="acao_aplicada" /></th>
              <th className="px-4 py-4 text-center text-xs font-black uppercase tracking-[0.18em] cursor-pointer select-none" onClick={() => toggleSort("qtd_tratativas")}>Qtd. <SortIcon colKey="qtd_tratativas" /></th>
              <th className="px-4 py-4 text-left text-xs font-black uppercase tracking-[0.18em] cursor-pointer select-none" onClick={() => toggleSort("status")}>Status RH <SortIcon colKey="status" /></th>
              <th className="px-4 py-4 text-left text-xs font-black uppercase tracking-[0.18em]">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="7" className="p-6 text-center text-slate-500">Carregando...</td></tr>
            ) : sortedGroups.length === 0 ? (
              <tr><td colSpan="7" className="p-6 text-center text-slate-500">Nenhuma tratativa encontrada para este período.</td></tr>
            ) : (
              sortedGroups.map((g) => (
                <tr key={g.key} className="border-t border-slate-100 transition-colors hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-600">{brDateTime(g.ultima_data)}</td>
                  <td className="px-4 py-3 font-semibold text-slate-800">{g.motorista_nome || "—"}</td>
                  <td className="px-4 py-3 text-slate-700">{g.motorista_chapa || "—"}</td>
                  <td className="px-4 py-3"><BadgeAcao acao={g.acao_aplicada} /></td>
                  <td className="px-4 py-3 text-center font-semibold text-slate-900">{g.qtd_tratativas}</td>
                  <td className="px-4 py-3"><StatusPill lancado={g.rh_lancado} /></td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => openGroup(g)}
                      className={["rounded-2xl px-4 py-2 text-sm font-bold text-white transition", g.rh_lancado ? "bg-slate-700 hover:bg-slate-800" : "bg-violet-600 hover:bg-violet-700"].join(" ")}
                    >
                      {g.rh_lancado ? "Consultar" : "Lançar"}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {modalOpen && grupoSel && !grupoSel.rh_lancado && (
        <TratativasLancarRH aberto={modalOpen} grupo={grupoSel} onClose={closeModal} onSaved={async () => { closeModal(); await load(); }} />
      )}
      {modalOpen && grupoSel && grupoSel.rh_lancado && (
        <TratativasConsultarRH aberto={modalOpen} grupo={grupoSel} onClose={closeModal} />
      )}
    </div>
  );
}
