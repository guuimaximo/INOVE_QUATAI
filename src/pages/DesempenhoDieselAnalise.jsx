import React, { useEffect, useMemo, useState } from "react";
import {
  FaBolt,
  FaSync,
  FaFilePdf,
  FaFilter,
  FaSearch,
  FaChartLine,
  FaRoad,
  FaTruck,
  FaUser,
  FaClipboardList,
} from "react-icons/fa";
import { supabase } from "../supabase";

function n(v) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function clsx(...arr) {
  return arr.filter(Boolean).join(" ");
}

function getPublicUrl(path) {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  const base = import.meta.env.VITE_SUPABASE_URL;
  const bucket = "relatorios";
  const cleanPath = path.startsWith("/") ? path.slice(1) : path;
  return `${base}/storage/v1/object/public/${bucket}/${cleanPath}`;
}

function normalizar(v) {
  return String(v || "").trim().toUpperCase();
}

export default function DesempenhoDieselAnalise() {
  const [loading, setLoading] = useState(false);
  const [snapshot, setSnapshot] = useState(null);
  const [historico, setHistorico] = useState([]);

  const [busca, setBusca] = useState("");
  const [filtroLinha, setFiltroLinha] = useState("");
  const [filtroCluster, setFiltroCluster] = useState("");
  const [filtroCheckpoint, setFiltroCheckpoint] = useState("");

  async function carregar() {
    setLoading(true);
    try {
      const { data: ult } = await supabase
        .from("diesel_analise_gerencial_snapshot")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const { data: hist } = await supabase
        .from("diesel_analise_gerencial_snapshot")
        .select("id, report_id, periodo_label, mes_atual_nome, created_at")
        .order("created_at", { ascending: false })
        .limit(20);

      setSnapshot(ult || null);
      setHistorico(hist || []);
    } catch (e) {
      alert("Erro ao carregar análise: " + (e?.message || String(e)));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  const linhas = useMemo(() => {
    const base = snapshot?.tabela_linhas || [];
    return [...new Set(base.map((r) => normalizar(r.linha)).filter(Boolean))].sort();
  }, [snapshot]);

  const clusters = useMemo(() => {
    const base = snapshot?.top_veiculos || [];
    return [...new Set(base.map((r) => normalizar(r.Cluster)).filter(Boolean))].sort();
  }, [snapshot]);

  const tabelaLinhasFiltrada = useMemo(() => {
    let rows = [...(snapshot?.tabela_linhas || [])];

    if (filtroLinha) {
      rows = rows.filter((r) => normalizar(r.linha) === filtroLinha);
    }

    if (busca.trim()) {
      const q = busca.toLowerCase().trim();
      rows = rows.filter((r) => String(r.linha || "").toLowerCase().includes(q));
    }

    return rows;
  }, [snapshot, filtroLinha, busca]);

  const topVeiculosFiltrado = useMemo(() => {
    let rows = [...(snapshot?.top_veiculos || [])];

    if (filtroLinha) {
      rows = rows.filter((r) => normalizar(r.linha) === filtroLinha);
    }

    if (filtroCluster) {
      rows = rows.filter((r) => normalizar(r.Cluster) === filtroCluster);
    }

    if (busca.trim()) {
      const q = busca.toLowerCase().trim();
      rows = rows.filter((r) =>
        String(r.veiculo || "").toLowerCase().includes(q) ||
        String(r.linha || "").toLowerCase().includes(q)
      );
    }

    return rows;
  }, [snapshot, filtroLinha, filtroCluster, busca]);

  const topMotoristasFiltrado = useMemo(() => {
    let rows = [...(snapshot?.top_motoristas || [])];

    if (filtroLinha) {
      rows = rows.filter((r) => normalizar(r.linha) === filtroLinha);
    }

    if (filtroCluster) {
      rows = rows.filter((r) => normalizar(r.Cluster) === filtroCluster);
    }

    if (busca.trim()) {
      const q = busca.toLowerCase().trim();
      rows = rows.filter((r) =>
        String(r.Motorista || "").toLowerCase().includes(q) ||
        String(r.linha || "").toLowerCase().includes(q)
      );
    }

    return rows;
  }, [snapshot, filtroLinha, filtroCluster, busca]);

  const checkpointTabelaFiltrada = useMemo(() => {
    let rows = [...(snapshot?.checkpoint_tabela || [])];

    if (filtroLinha) {
      rows = rows.filter((r) => normalizar(r.linha_foco) === filtroLinha);
    }

    if (filtroCheckpoint) {
      rows = rows.filter((r) => normalizar(r.tipo) === filtroCheckpoint);
    }

    if (busca.trim()) {
      const q = busca.toLowerCase().trim();
      rows = rows.filter((r) =>
        String(r.motorista_nome || "").toLowerCase().includes(q) ||
        String(r.motorista_chapa || "").toLowerCase().includes(q) ||
        String(r.linha_foco || "").toLowerCase().includes(q)
      );
    }

    return rows;
  }, [snapshot, filtroLinha, filtroCheckpoint, busca]);

  const resumo = snapshot?.resumo || {};
  const cobertura = resumo?.cobertura || {};
  const instrutor = resumo?.instrutor_kpis || {};
  const checkpointKpis = snapshot?.checkpoint_kpis || resumo?.checkpoint_kpis || {};
  const pdfUrl = getPublicUrl(snapshot?.arquivo_pdf_path);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between gap-4 border-b pb-4">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-lg">
            <FaBolt size={20} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Análise Gerencial Diesel</h2>
            <p className="text-sm text-slate-500">
              Página analítica do relatório gerencial com filtros e drill-down
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {pdfUrl && (
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 rounded-xl bg-rose-600 text-white font-bold text-sm inline-flex items-center gap-2"
            >
              <FaFilePdf /> Abrir PDF
            </a>
          )}
          <button
            onClick={carregar}
            className="p-2 text-slate-500 hover:bg-slate-100 rounded-full"
            title="Atualizar"
          >
            <FaSync className={clsx(loading && "animate-spin")} />
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border shadow-sm p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="relative md:col-span-2">
            <FaSearch className="absolute left-3 top-3.5 text-gray-400" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar linha, veículo, motorista ou chapa..."
              className="pl-9 p-2.5 border rounded-lg w-full text-sm outline-none"
            />
          </div>

          <div className="flex items-center gap-2 bg-slate-50 border rounded-lg px-2">
            <FaFilter className="text-gray-400 ml-2" />
            <select
              value={filtroLinha}
              onChange={(e) => setFiltroLinha(e.target.value)}
              className="p-2.5 bg-transparent text-sm outline-none w-full"
            >
              <option value="">Todas as linhas</option>
              {linhas.map((ln) => (
                <option key={ln} value={ln}>{ln}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 bg-slate-50 border rounded-lg px-2">
            <FaFilter className="text-gray-400 ml-2" />
            <select
              value={filtroCluster}
              onChange={(e) => setFiltroCluster(e.target.value)}
              className="p-2.5 bg-transparent text-sm outline-none w-full"
            >
              <option value="">Todos os clusters</option>
              {clusters.map((cl) => (
                <option key={cl} value={cl}>{cl}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-3">
          <div className="flex items-center gap-2 bg-slate-50 border rounded-lg px-2">
            <FaClipboardList className="text-gray-400 ml-2" />
            <select
              value={filtroCheckpoint}
              onChange={(e) => setFiltroCheckpoint(e.target.value)}
              className="p-2.5 bg-transparent text-sm outline-none w-full"
            >
              <option value="">Todos checkpoints</option>
              <option value="PRONTUARIO_10">PRONTUÁRIO 10</option>
              <option value="PRONTUARIO_20">PRONTUÁRIO 20</option>
              <option value="PRONTUARIO_30">PRONTUÁRIO 30</option>
            </select>
          </div>

          <div className="md:col-span-3 text-sm text-slate-500 flex items-center">
            Período: <b className="ml-1 text-slate-700">{snapshot?.periodo_label || "-"}</b>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border shadow-sm">
          <p className="text-sm text-gray-500 font-bold">Desperdício total</p>
          <p className="text-2xl font-black text-rose-700">{n(resumo.total_desperdicio).toFixed(0)} L</p>
        </div>

        <div className="bg-white p-4 rounded-xl border shadow-sm">
          <p className="text-sm text-gray-500 font-bold">Registros válidos</p>
          <p className="text-2xl font-black text-slate-800">{n(cobertura.qtd_clean).toFixed(0)}</p>
        </div>

        <div className="bg-white p-4 rounded-xl border shadow-sm">
          <p className="text-sm text-gray-500 font-bold">CP10</p>
          <p className="text-2xl font-black text-slate-800">{n(checkpointKpis.cp10_total).toFixed(0)}</p>
        </div>

        <div className="bg-white p-4 rounded-xl border shadow-sm">
          <p className="text-sm text-gray-500 font-bold">CP20 + CP30</p>
          <p className="text-2xl font-black text-slate-800">
            {(n(checkpointKpis.cp20_total) + n(checkpointKpis.cp30_total)).toFixed(0)}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
        <div className="p-4 border-b bg-slate-50">
          <h3 className="font-extrabold text-slate-800 inline-flex items-center gap-2">
            <FaRoad /> Eficiência por Linha
          </h3>
          <p className="text-xs text-slate-500">
            Total: <b>{snapshot?.tabela_linhas?.length || 0}</b> | Filtradas: <b>{tabelaLinhasFiltrada.length}</b>
          </p>
        </div>

        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-slate-500 bg-white border-b">
              <tr>
                <th className="p-3 text-left">Linha</th>
                <th className="p-3 text-right">KML Anterior</th>
                <th className="p-3 text-right">KML Atual</th>
                <th className="p-3 text-right">Variação %</th>
                <th className="p-3 text-right">Meta</th>
                <th className="p-3 text-right">Desperdício</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {tabelaLinhasFiltrada.map((r, i) => (
                <tr key={i}>
                  <td className="p-3 font-bold">{r.linha}</td>
                  <td className="p-3 text-right">{n(r.KML_Anterior).toFixed(2)}</td>
                  <td className="p-3 text-right">{n(r.KML_Atual).toFixed(2)}</td>
                  <td className="p-3 text-right">{n(r.Variacao_Pct).toFixed(1)}%</td>
                  <td className="p-3 text-right">{n(r.Meta_Ponderada).toFixed(2)}</td>
                  <td className="p-3 text-right text-rose-700 font-bold">{n(r.Desperdicio).toFixed(0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
          <div className="p-4 border-b bg-slate-50">
            <h3 className="font-extrabold text-slate-800 inline-flex items-center gap-2">
              <FaTruck /> Top Veículos
            </h3>
          </div>
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-slate-500 bg-white border-b">
                <tr>
                  <th className="p-3 text-left">Veículo</th>
                  <th className="p-3 text-left">Cluster</th>
                  <th className="p-3 text-left">Linha</th>
                  <th className="p-3 text-right">KML</th>
                  <th className="p-3 text-right">Meta</th>
                  <th className="p-3 text-right">Desp.</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {topVeiculosFiltrado.map((r, i) => (
                  <tr key={i}>
                    <td className="p-3 font-bold">{r.veiculo}</td>
                    <td className="p-3">{r.Cluster}</td>
                    <td className="p-3">{r.linha}</td>
                    <td className="p-3 text-right">{n(r.KML_Real).toFixed(2)}</td>
                    <td className="p-3 text-right">{n(r.Meta_Linha).toFixed(2)}</td>
                    <td className="p-3 text-right text-rose-700 font-bold">{n(r.Litros_Desp_Meta).toFixed(0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
          <div className="p-4 border-b bg-slate-50">
            <h3 className="font-extrabold text-slate-800 inline-flex items-center gap-2">
              <FaUser /> Top Motoristas
            </h3>
          </div>
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-slate-500 bg-white border-b">
                <tr>
                  <th className="p-3 text-left">Motorista</th>
                  <th className="p-3 text-left">Cluster</th>
                  <th className="p-3 text-left">Linha</th>
                  <th className="p-3 text-right">KML</th>
                  <th className="p-3 text-right">Meta</th>
                  <th className="p-3 text-right">Desp.</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {topMotoristasFiltrado.map((r, i) => (
                  <tr key={i}>
                    <td className="p-3 font-bold">{r.Motorista}</td>
                    <td className="p-3">{r.Cluster}</td>
                    <td className="p-3">{r.linha}</td>
                    <td className="p-3 text-right">{n(r.KML_Real).toFixed(2)}</td>
                    <td className="p-3 text-right">{n(r.Meta_Linha).toFixed(2)}</td>
                    <td className="p-3 text-right text-rose-700 font-bold">{n(r.Litros_Desp_Meta).toFixed(0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
        <div className="p-4 border-b bg-slate-50">
          <h3 className="font-extrabold text-slate-800 inline-flex items-center gap-2">
            <FaClipboardList /> Checkpoints
          </h3>
          <p className="text-xs text-slate-500">
            Total: <b>{snapshot?.checkpoint_tabela?.length || 0}</b> | Filtrados: <b>{checkpointTabelaFiltrada.length}</b>
          </p>
        </div>

        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-slate-500 bg-white border-b">
              <tr>
                <th className="p-3 text-left">Data</th>
                <th className="p-3 text-left">Tipo</th>
                <th className="p-3 text-left">Motorista</th>
                <th className="p-3 text-left">Linha</th>
                <th className="p-3 text-right">Δ KML</th>
                <th className="p-3 text-right">Δ Desp.</th>
                <th className="p-3 text-left">Conclusão</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {checkpointTabelaFiltrada.map((r, i) => (
                <tr key={i}>
                  <td className="p-3">{String(r.created_at_dt || "").slice(0, 10)}</td>
                  <td className="p-3 font-bold">{r.tipo}</td>
                  <td className="p-3">{r.motorista_nome} ({r.motorista_chapa})</td>
                  <td className="p-3">{r.linha_foco}</td>
                  <td className="p-3 text-right">{n(r.delta_kml).toFixed(2)}</td>
                  <td className="p-3 text-right">{n(r.delta_desperdicio).toFixed(1)}</td>
                  <td className="p-3">{r.conclusao}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-2xl border shadow-sm p-4">
        <h3 className="font-extrabold text-slate-800 mb-3">Histórico de snapshots</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          {historico.map((r) => (
            <div key={r.id} className="border rounded-xl p-3 bg-slate-50">
              <div className="text-sm font-black text-slate-800">Relatório #{r.report_id}</div>
              <div className="text-xs text-slate-500 mt-1">{r.periodo_label || "-"}</div>
              <div className="text-xs text-slate-500">{r.mes_atual_nome || "-"}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
