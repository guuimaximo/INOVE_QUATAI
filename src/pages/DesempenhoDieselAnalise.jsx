import React, { useEffect, useMemo, useState } from "react";
import {
  FaBolt,
  FaSync,
  FaFilePdf,
  FaFilter,
  FaSearch,
  FaRoad,
  FaTruck,
  FaUser,
  FaClipboardList,
  FaCalendarAlt,
  FaDatabase,
  FaCheckCircle,
  FaExclamationTriangle,
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

function fmtDateBr(v) {
  if (!v) return "-";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString("pt-BR");
}

function CardResumo({ titulo, valor, subtitulo, icon: Icon, destaque = "slate" }) {
  const mapa = {
    slate: "bg-slate-50 border-slate-200 text-slate-800",
    rose: "bg-rose-50 border-rose-200 text-rose-700",
    emerald: "bg-emerald-50 border-emerald-200 text-emerald-700",
    amber: "bg-amber-50 border-amber-200 text-amber-700",
    cyan: "bg-cyan-50 border-cyan-200 text-cyan-700",
  };

  return (
    <div className={clsx("rounded-2xl border p-4 shadow-sm", mapa[destaque] || mapa.slate)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide opacity-80">{titulo}</p>
          <p className="text-2xl font-black mt-1">{valor}</p>
          {subtitulo ? <p className="text-xs mt-1 opacity-80">{subtitulo}</p> : null}
        </div>
        {Icon ? (
          <div className="h-10 w-10 rounded-xl bg-white/70 flex items-center justify-center border">
            <Icon size={16} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function BlocoSecao({ titulo, subtitulo, icon: Icon, children, right }) {
  return (
    <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b bg-slate-50 flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            {Icon ? <Icon className="text-slate-600" /> : null}
            <h3 className="text-base font-extrabold text-slate-800">{titulo}</h3>
          </div>
          {subtitulo ? <p className="text-xs text-slate-500 mt-1">{subtitulo}</p> : null}
        </div>
        {right}
      </div>
      <div>{children}</div>
    </div>
  );
}

function TabelaPadrao({ columns, rows, emptyText = "Sem dados disponíveis" }) {
  return (
    <div className="overflow-auto">
      <table className="w-full text-sm">
        <thead className="bg-white border-b text-[11px] uppercase tracking-wide text-slate-500">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className={clsx(
                  "px-4 py-3 font-extrabold whitespace-nowrap",
                  col.align === "right" ? "text-right" : "text-left"
                )}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-8 text-center text-slate-400">
                {emptyText}
              </td>
            </tr>
          ) : (
            rows.map((row, idx) => (
              <tr key={idx} className="hover:bg-slate-50 transition-colors">
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={clsx(
                      "px-4 py-3 whitespace-nowrap",
                      col.align === "right" ? "text-right" : "text-left",
                      col.className
                    )}
                  >
                    {col.render ? col.render(row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
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
      rows = rows.filter(
        (r) =>
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
      rows = rows.filter(
        (r) =>
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
      rows = rows.filter(
        (r) =>
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
      <div className="bg-white rounded-3xl border shadow-sm overflow-hidden">
        <div className="px-6 py-5 bg-slate-900 text-white">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-2xl bg-white/10 flex items-center justify-center border border-white/10">
                <FaBolt size={20} />
              </div>
              <div>
                <h2 className="text-2xl font-black">Análise Gerencial Diesel</h2>
                <p className="text-sm text-slate-300">
                  Painel analítico consolidado da última geração do relatório
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {pdfUrl && (
                <a
                  href={pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm inline-flex items-center gap-2"
                >
                  <FaFilePdf /> Abrir PDF
                </a>
              )}

              <button
                onClick={carregar}
                className="h-10 w-10 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 flex items-center justify-center"
                title="Atualizar"
              >
                <FaSync className={clsx(loading && "animate-spin")} />
              </button>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 bg-slate-50 border-t flex flex-wrap items-center gap-3 text-sm">
          <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border">
            <FaCalendarAlt className="text-slate-500" />
            <span className="text-slate-500 font-bold">Período:</span>
            <span className="font-extrabold text-slate-800">{snapshot?.periodo_label || "-"}</span>
          </div>

          <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border">
            <FaDatabase className="text-slate-500" />
            <span className="text-slate-500 font-bold">Mês ref.:</span>
            <span className="font-extrabold text-slate-800">{snapshot?.mes_atual_nome || "-"}</span>
          </div>

          <div
            className={clsx(
              "inline-flex items-center gap-2 px-3 py-2 rounded-xl border",
              snapshot ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-amber-50 border-amber-200 text-amber-700"
            )}
          >
            {snapshot ? <FaCheckCircle /> : <FaExclamationTriangle />}
            <span className="font-bold">{snapshot ? "Snapshot carregado" : "Sem snapshot disponível"}</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border shadow-sm p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="relative md:col-span-2">
            <FaSearch className="absolute left-3 top-3.5 text-slate-400" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar linha, veículo, motorista ou chapa..."
              className="pl-9 pr-3 py-2.5 border rounded-xl w-full text-sm outline-none"
            />
          </div>

          <div className="flex items-center gap-2 bg-slate-50 border rounded-xl px-2">
            <FaFilter className="text-slate-400 ml-2" />
            <select
              value={filtroLinha}
              onChange={(e) => setFiltroLinha(e.target.value)}
              className="p-2.5 bg-transparent text-sm outline-none w-full"
            >
              <option value="">Todas as linhas</option>
              {linhas.map((ln) => (
                <option key={ln} value={ln}>
                  {ln}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 bg-slate-50 border rounded-xl px-2">
            <FaFilter className="text-slate-400 ml-2" />
            <select
              value={filtroCluster}
              onChange={(e) => setFiltroCluster(e.target.value)}
              className="p-2.5 bg-transparent text-sm outline-none w-full"
            >
              <option value="">Todos os clusters</option>
              {clusters.map((cl) => (
                <option key={cl} value={cl}>
                  {cl}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-3">
          <div className="flex items-center gap-2 bg-slate-50 border rounded-xl px-2">
            <FaClipboardList className="text-slate-400 ml-2" />
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

          <div className="md:col-span-3 flex items-center text-sm text-slate-500">
            Histórico disponível: <b className="ml-1 text-slate-700">{historico.length}</b>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        <CardResumo
          titulo="Desperdício total"
          valor={`${n(resumo.total_desperdicio).toFixed(0)} L`}
          subtitulo="Base da análise atual"
          icon={FaBolt}
          destaque="rose"
        />

        <CardResumo
          titulo="Registros válidos"
          valor={n(cobertura.qtd_clean).toFixed(0)}
          subtitulo={`Bruto: ${n(cobertura.qtd_bruto).toFixed(0)}`}
          icon={FaDatabase}
          destaque="slate"
        />

        <CardResumo
          titulo="CP10"
          valor={n(checkpointKpis.cp10_total).toFixed(0)}
          subtitulo={`Melhorou: ${n(checkpointKpis.cp10_melhorou).toFixed(0)}`}
          icon={FaClipboardList}
          destaque="cyan"
        />

        <CardResumo
          titulo="CP20"
          valor={n(checkpointKpis.cp20_total).toFixed(0)}
          subtitulo={`Melhorou: ${n(checkpointKpis.cp20_melhorou).toFixed(0)}`}
          icon={FaClipboardList}
          destaque="amber"
        />

        <CardResumo
          titulo="CP30"
          valor={n(checkpointKpis.cp30_total).toFixed(0)}
          subtitulo={`Melhorou: ${n(checkpointKpis.cp30_melhorou).toFixed(0)}`}
          icon={FaClipboardList}
          destaque="emerald"
        />
      </div>

      <BlocoSecao
        titulo="Eficiência por Linha"
        subtitulo={`Total: ${snapshot?.tabela_linhas?.length || 0} | Filtradas: ${tabelaLinhasFiltrada.length}`}
        icon={FaRoad}
      >
        <TabelaPadrao
          rows={tabelaLinhasFiltrada}
          columns={[
            { key: "linha", label: "Linha", render: (r) => <span className="font-extrabold">{r.linha}</span> },
            { key: "KML_Anterior", label: "KML Anterior", align: "right", render: (r) => n(r.KML_Anterior).toFixed(2) },
            { key: "KML_Atual", label: "KML Atual", align: "right", render: (r) => n(r.KML_Atual).toFixed(2) },
            { key: "Variacao_Pct", label: "Variação %", align: "right", render: (r) => `${n(r.Variacao_Pct).toFixed(1)}%` },
            { key: "Meta_Ponderada", label: "Meta", align: "right", render: (r) => n(r.Meta_Ponderada).toFixed(2) },
            {
              key: "Desperdicio",
              label: "Desperdício",
              align: "right",
              className: "font-extrabold text-rose-700",
              render: (r) => n(r.Desperdicio).toFixed(0),
            },
          ]}
        />
      </BlocoSecao>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <BlocoSecao
          titulo="Top Veículos"
          subtitulo={`Total filtrado: ${topVeiculosFiltrado.length}`}
          icon={FaTruck}
        >
          <TabelaPadrao
            rows={topVeiculosFiltrado}
            columns={[
              { key: "veiculo", label: "Veículo", render: (r) => <span className="font-extrabold">{r.veiculo}</span> },
              { key: "Cluster", label: "Cluster" },
              { key: "linha", label: "Linha" },
              { key: "KML_Real", label: "KML", align: "right", render: (r) => n(r.KML_Real).toFixed(2) },
              { key: "Meta_Linha", label: "Meta", align: "right", render: (r) => n(r.Meta_Linha).toFixed(2) },
              {
                key: "Litros_Desp_Meta",
                label: "Desp.",
                align: "right",
                className: "font-extrabold text-rose-700",
                render: (r) => n(r.Litros_Desp_Meta).toFixed(0),
              },
            ]}
          />
        </BlocoSecao>

        <BlocoSecao
          titulo="Top Motoristas"
          subtitulo={`Total filtrado: ${topMotoristasFiltrado.length}`}
          icon={FaUser}
        >
          <TabelaPadrao
            rows={topMotoristasFiltrado}
            columns={[
              { key: "Motorista", label: "Motorista", render: (r) => <span className="font-extrabold">{r.Motorista}</span> },
              { key: "Cluster", label: "Cluster" },
              { key: "linha", label: "Linha" },
              { key: "KML_Real", label: "KML", align: "right", render: (r) => n(r.KML_Real).toFixed(2) },
              { key: "Meta_Linha", label: "Meta", align: "right", render: (r) => n(r.Meta_Linha).toFixed(2) },
              {
                key: "Litros_Desp_Meta",
                label: "Desp.",
                align: "right",
                className: "font-extrabold text-rose-700",
                render: (r) => n(r.Litros_Desp_Meta).toFixed(0),
              },
            ]}
          />
        </BlocoSecao>
      </div>

      <BlocoSecao
        titulo="Checkpoints"
        subtitulo={`Total: ${snapshot?.checkpoint_tabela?.length || 0} | Filtrados: ${checkpointTabelaFiltrada.length}`}
        icon={FaClipboardList}
      >
        <TabelaPadrao
          rows={checkpointTabelaFiltrada}
          columns={[
            { key: "created_at_dt", label: "Data", render: (r) => String(r.created_at_dt || "").slice(0, 10) },
            { key: "tipo", label: "Tipo", render: (r) => <span className="font-extrabold">{r.tipo}</span> },
            {
              key: "motorista_nome",
              label: "Motorista",
              render: (r) => (
                <span>
                  {r.motorista_nome} <span className="text-slate-400">({r.motorista_chapa})</span>
                </span>
              ),
            },
            { key: "linha_foco", label: "Linha" },
            { key: "delta_kml", label: "Δ KML", align: "right", render: (r) => n(r.delta_kml).toFixed(2) },
            { key: "delta_desperdicio", label: "Δ Desp.", align: "right", render: (r) => n(r.delta_desperdicio).toFixed(1) },
            { key: "conclusao", label: "Conclusão", render: (r) => <span className="font-bold">{r.conclusao}</span> },
          ]}
        />
      </BlocoSecao>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <CardResumo
          titulo="Aguardando instrutor"
          valor={n(instrutor.aguardando).toFixed(0)}
          subtitulo="Fila atual"
          icon={FaExclamationTriangle}
          destaque="amber"
        />
        <CardResumo
          titulo="Em andamento"
          valor={n(instrutor.em_andamento).toFixed(0)}
          subtitulo="Monitoramentos ativos"
          icon={FaSync}
          destaque="cyan"
        />
        <CardResumo
          titulo="Concluídos"
          valor={n(instrutor.concluidos).toFixed(0)}
          subtitulo="Processos finalizados"
          icon={FaCheckCircle}
          destaque="emerald"
        />
      </div>

      <BlocoSecao
        titulo="Histórico de Snapshots"
        subtitulo="Últimas análises salvas no banco"
        icon={FaCalendarAlt}
      >
        <div className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          {historico.length === 0 ? (
            <div className="text-sm text-slate-400">Sem histórico disponível.</div>
          ) : (
            historico.map((r) => (
              <div key={r.id} className="border rounded-2xl p-4 bg-slate-50">
                <div className="text-sm font-black text-slate-800">Relatório #{r.report_id}</div>
                <div className="text-xs text-slate-500 mt-2">{r.periodo_label || "-"}</div>
                <div className="text-xs text-slate-500">{r.mes_atual_nome || "-"}</div>
                <div className="text-xs text-slate-400 mt-2">{fmtDateBr(r.created_at)}</div>
              </div>
            ))
          )}
        </div>
      </BlocoSecao>
    </div>
  );
}
