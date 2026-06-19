import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { FaChartLine, FaClipboard } from "react-icons/fa";
import { supabase } from "../../supabase";
import { MonitoramentoFrame, MonitoramentoSection, MonitoramentoStatCard } from "./MonitoramentoShell";

function formatBR(isoDate) {
  if (!isoDate) return "-";
  const [year, month, day] = String(isoDate).split("-");
  return day && month && year ? `${day}/${month}` : isoDate;
}

function TrendTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-lg">
      <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-bold text-slate-900">{payload[0].value}</div>
    </div>
  );
}

export default function MonitoramentoDashboard() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("vw_monitoramento_inspecoes_dashboard")
        .select("dt_evento,total_laudos,total_similaridade,total_irregularidade,total_inconclusivo,total_tecnica,total_rostos_camera,score_medio,score_medio_biometrico,score_medio_face_mesh,inspecionado")
        .order("dt_evento", { ascending: true });

      if (!alive) return;

      if (error) {
        console.error("Erro ao carregar dashboard do monitoramento:", error);
        setRows([]);
      } else {
        setRows(Array.isArray(data) ? data : []);
      }
      setLoading(false);
    })();

    return () => {
      alive = false;
    };
  }, []);

  const stats = useMemo(() => {
    const totalLaudos = rows.reduce((sum, row) => sum + Number(row.total_laudos || 0), 0);
    const totalSimilaridade = rows.reduce((sum, row) => sum + Number(row.total_similaridade || 0), 0);
    const totalIrregularidade = rows.reduce((sum, row) => sum + Number(row.total_irregularidade || 0), 0);
    const totalInconclusivo = rows.reduce((sum, row) => sum + Number(row.total_inconclusivo || 0), 0);
    const totalTecnica = rows.reduce((sum, row) => sum + Number(row.total_tecnica || 0), 0);
    const diasComLaudo = rows.filter((row) => Number(row.total_laudos || 0) > 0).length;
    const diasFechados = rows.filter((row) => row.inspecionado).length;
    const diasPendentes = rows.filter((row) => Number(row.total_laudos || 0) > 0 && !row.inspecionado).length;
    const validScores = rows.filter((row) => Number(row.score_medio || 0) > 0);
    const scoreMedio = validScores.length
      ? (validScores.reduce((sum, row) => sum + Number(row.score_medio || 0), 0) / validScores.length).toFixed(1)
      : "0.0";

    return {
      totalLaudos,
      totalSimilaridade,
      totalIrregularidade,
      totalInconclusivo,
      totalTecnica,
      diasComLaudo,
      diasFechados,
      diasPendentes,
      scoreMedio,
    };
  }, [rows]);

  const trendData = useMemo(
    () =>
      rows.map((row) => ({
        dia: formatBR(row.dt_evento),
        laudos: Number(row.total_laudos || 0),
        similares: Number(row.total_similaridade || 0),
        irregulares: Number(row.total_irregularidade || 0),
        inconclusivos: Number(row.total_inconclusivo || 0),
        tecnicas: Number(row.total_tecnica || 0),
      })),
    [rows]
  );

  const statusData = useMemo(
    () => [
      { nome: "Com laudo", valor: stats.diasComLaudo, tone: "emerald" },
      { nome: "Pendentes", valor: stats.diasPendentes, tone: "amber" },
      { nome: "Fechados", valor: stats.diasFechados, tone: "rose" },
    ],
    [stats.diasComLaudo, stats.diasFechados, stats.diasPendentes]
  );

  const actionData = useMemo(
    () => [
      { nome: "Similaridade", valor: stats.totalSimilaridade },
      { nome: "Irregularidade", valor: stats.totalIrregularidade },
      { nome: "Inconclusivo", valor: stats.totalInconclusivo },
      { nome: "Técnica", valor: stats.totalTecnica },
    ],
    [stats]
  );

  return (
    <MonitoramentoFrame
      title="Dashboard"
      icon={<FaChartLine className="text-lg" />}
      activeTab="dashboard"
      description="Resumo enxuto do monitoramento com base nos últimos 1000 laudos processados. A ideia aqui é enxergar a operação sem varrer o banco inteiro."
    >
      <MonitoramentoSection title="Resumo do período" subtitle="Indicadores consolidados do recorte recente">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <MonitoramentoStatCard title="Total de laudos" value={stats.totalLaudos.toLocaleString("pt-BR")} tone="blue" />
          <MonitoramentoStatCard title="Dias com laudo" value={stats.diasComLaudo.toLocaleString("pt-BR")} tone="emerald" />
          <MonitoramentoStatCard title="Dias fechados" value={stats.diasFechados.toLocaleString("pt-BR")} tone="amber" />
          <MonitoramentoStatCard title="Score médio" value={stats.scoreMedio} tone="slate" helper="média dos dias com score válido" />
        </div>
      </MonitoramentoSection>

      <div className="grid gap-4 xl:grid-cols-[1.35fr_0.9fr]">
        <MonitoramentoSection title="Tendência diária" subtitle="Volume dos laudos processados no recorte recente">
          <div className="h-[300px]">
            {loading ? (
              <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-sm font-semibold text-slate-400">
                Carregando dashboard...
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="4 4" stroke="#E2E8F0" />
                  <XAxis dataKey="dia" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip content={<TrendTooltip />} />
                  <Line type="monotone" dataKey="laudos" stroke="#2563EB" strokeWidth={3} dot={false} />
                  <Line type="monotone" dataKey="similares" stroke="#059669" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="irregulares" stroke="#DC2626" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </MonitoramentoSection>

        <MonitoramentoSection title="Status dos dias" subtitle="Situação dos dias no recorte recente">
          <div className="space-y-3">
            {statusData.map((item) => (
              <div key={item.nome} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <span className="text-sm font-semibold text-slate-700">{item.nome}</span>
                <span
                  className={`rounded-full px-3 py-1 text-sm font-black ${
                    item.tone === "emerald"
                      ? "bg-emerald-100 text-emerald-700"
                      : item.tone === "amber"
                      ? "bg-amber-100 text-amber-700"
                      : "bg-rose-100 text-rose-700"
                  }`}
                >
                  {item.valor}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-4 h-[210px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={actionData} margin={{ top: 10, right: 6, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="4 4" stroke="#E2E8F0" />
                <XAxis dataKey="nome" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="valor" fill="#2563EB" radius={[10, 10, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </MonitoramentoSection>
      </div>

      <MonitoramentoSection
        title="Leitura rápida"
        subtitle="Painel compacto com os números que ajudam na operação"
        actions={
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-600">
            <FaClipboard /> {stats.totalLaudos.toLocaleString("pt-BR")} laudos no recorte
          </span>
        }
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Similaridade</p>
            <p className="mt-2 text-2xl font-black text-emerald-700">{stats.totalSimilaridade.toLocaleString("pt-BR")}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Irregularidade</p>
            <p className="mt-2 text-2xl font-black text-rose-700">{stats.totalIrregularidade.toLocaleString("pt-BR")}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Inconclusivo</p>
            <p className="mt-2 text-2xl font-black text-amber-700">{stats.totalInconclusivo.toLocaleString("pt-BR")}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Técnica</p>
            <p className="mt-2 text-2xl font-black text-slate-700">{stats.totalTecnica.toLocaleString("pt-BR")}</p>
          </div>
        </div>
      </MonitoramentoSection>
    </MonitoramentoFrame>
  );
}
