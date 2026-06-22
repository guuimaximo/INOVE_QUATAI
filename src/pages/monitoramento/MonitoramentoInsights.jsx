import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, Cell, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { FaChartPie, FaClock, FaIdCard, FaExclamationTriangle } from "react-icons/fa";
import { supabase } from "../../supabase";
import { MonitoramentoFrame, MonitoramentoSection, MonitoramentoStatCard } from "./MonitoramentoShell";

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function rotuloMes(ym) {
  // ym = "YYYY-MM"
  const [y, m] = String(ym || "").split("-");
  const mi = Number(m) - 1;
  return mi >= 0 && mi < 12 ? `${MESES[mi]}/${String(y).slice(2)}` : ym;
}

function num(v) {
  const n = Number(v || 0);
  return Number.isFinite(n) ? n : 0;
}

function FraudeTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-lg">
      <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="text-sm font-bold text-slate-900">
          {p.name}: {p.value}
        </div>
      ))}
    </div>
  );
}

export default function MonitoramentoInsights() {
  const [loading, setLoading] = useState(true);
  const [cartoes, setCartoes] = useState([]);
  const [mensal, setMensal] = useState([]);
  const [horario, setHorario] = useState([]);
  const [reincidentes, setReincidentes] = useState([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const [c, m, h, r] = await Promise.all([
        supabase.from("vw_monitoramento_cartoes").select("*"),
        supabase.from("vw_monitoramento_fraude_mensal").select("*"),
        supabase.from("vw_monitoramento_fraude_horario").select("*"),
        supabase.from("vw_monitoramento_cartoes_reincidentes").select("*").limit(20),
      ]);
      if (!alive) return;
      setCartoes(Array.isArray(c.data) ? c.data : []);
      setMensal(Array.isArray(m.data) ? m.data : []);
      setHorario(Array.isArray(h.data) ? h.data : []);
      setReincidentes(Array.isArray(r.data) ? r.data : []);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, []);

  const kpis = useMemo(() => {
    const total = cartoes.reduce((s, c) => s + num(c.total_laudos), 0);
    const irregular = cartoes.reduce((s, c) => s + num(c.total_irregularidade), 0);
    const similar = cartoes.reduce((s, c) => s + num(c.total_similaridade), 0);
    const cartoesDistintos = cartoes.reduce((s, c) => s + num(c.cartoes_distintos), 0);
    const taxaFraude = total ? ((irregular / total) * 100).toFixed(1) : "0.0";
    return { total, irregular, similar, cartoesDistintos, taxaFraude };
  }, [cartoes]);

  const dadosMes = useMemo(
    () =>
      mensal.map((m) => ({
        label: rotuloMes(m.mes),
        similar: num(m.total_similaridade),
        inconclusivo: num(m.total_inconclusivo),
        irregular: num(m.total_irregularidade),
        tecnica: num(m.total_tecnica),
      })),
    [mensal],
  );

  const dadosHora = useMemo(
    () => horario.map((h) => ({ hora: `${String(num(h.hora)).padStart(2, "0")}h`, irregular: num(h.total_irregularidade) })),
    [horario],
  );
  const horaPico = useMemo(
    () => dadosHora.reduce((max, h) => (h.irregular > max.irregular ? h : max), dadosHora[0] || { hora: "-", irregular: 0 }),
    [dadosHora],
  );

  const cartoesOrdenados = useMemo(
    () => [...cartoes].sort((a, b) => num(b.total_irregularidade) - num(a.total_irregularidade)),
    [cartoes],
  );

  return (
    <MonitoramentoFrame
      title="Insights"
      icon={<FaChartPie className="text-lg" />}
      activeTab="insights"
      description="Leitura analítica de todo o histórico: fraude por mês, por tipo de cartão, por horário e cartões reincidentes."
    >
      <MonitoramentoSection title="Visão geral" subtitle="Indicadores consolidados de todo o histórico">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <MonitoramentoStatCard title="Total de laudos" value={kpis.total.toLocaleString("pt-BR")} tone="blue" />
          <MonitoramentoStatCard title="Irregularidades" value={kpis.irregular.toLocaleString("pt-BR")} tone="rose" helper={`${kpis.taxaFraude}% do total`} />
          <MonitoramentoStatCard title="Similaridades" value={kpis.similar.toLocaleString("pt-BR")} tone="emerald" />
          <MonitoramentoStatCard title="Cartões analisados" value={kpis.cartoesDistintos.toLocaleString("pt-BR")} tone="slate" helper="códigos distintos" />
        </div>
      </MonitoramentoSection>

      <MonitoramentoSection title="Laudos por mês" subtitle="Volume mensal separado por ação">
        <div className="h-[320px]">
          {loading ? (
            <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-sm font-semibold text-slate-400">Carregando...</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dadosMes} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="4 4" stroke="#E2E8F0" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip content={<FraudeTooltip />} />
                <Bar dataKey="similar" name="Similar" stackId="a" fill="#059669" />
                <Bar dataKey="inconclusivo" name="Inconclusivo" stackId="a" fill="#D97706" />
                <Bar dataKey="irregular" name="Irregular" stackId="a" fill="#DC2626" />
                <Bar dataKey="tecnica" name="Técnica" stackId="a" fill="#94A3B8" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </MonitoramentoSection>

      <div className="grid gap-4 xl:grid-cols-2">
        <MonitoramentoSection
          title="Tipos de cartão com mais fraude"
          subtitle="Ranking por irregularidades confirmadas"
          actions={<span className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-600"><FaIdCard /> {cartoesOrdenados[0]?.tipo_cartao || "-"}</span>}
        >
          <div className="space-y-2">
            {cartoesOrdenados.slice(0, 8).map((t) => (
              <div key={t.tipo_cartao} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-slate-800">{t.tipo_cartao}</p>
                  <p className="text-xs text-slate-500">{num(t.total_laudos)} laudos · {num(t.taxa_fraude).toFixed(1)}% de fraude</p>
                </div>
                <span className="rounded-full bg-rose-100 px-3 py-1 text-sm font-black text-rose-700">{num(t.total_irregularidade)}</span>
              </div>
            ))}
            {cartoesOrdenados.length === 0 && !loading && <p className="py-8 text-center text-sm text-slate-400">Sem dados.</p>}
          </div>
        </MonitoramentoSection>

        <MonitoramentoSection
          title="Fraude por horário"
          subtitle="Distribuição das irregularidades ao longo do dia"
          actions={<span className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700"><FaClock /> Pico: {horaPico.hora} ({horaPico.irregular})</span>}
        >
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dadosHora} margin={{ top: 10, right: 6, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="4 4" stroke="#E2E8F0" />
                <XAxis dataKey="hora" tick={{ fontSize: 9 }} interval={1} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip content={<FraudeTooltip />} />
                <Bar dataKey="irregular" name="Irregularidades" radius={[6, 6, 0, 0]}>
                  {dadosHora.map((h, i) => (
                    <Cell key={i} fill={h.hora === horaPico.hora ? "#DC2626" : "#F87171"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </MonitoramentoSection>
      </div>

      <MonitoramentoSection
        title="Cartões reincidentes"
        subtitle="Mesmo cartão com 2+ irregularidades — prioridade de investigação"
        actions={<span className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-600"><FaExclamationTriangle /> {reincidentes.length} cartões</span>}
      >
        {reincidentes.length === 0 ? (
          <p className="py-10 text-center text-sm font-semibold text-slate-400">Nenhum cartão com reincidência.</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2 font-bold">Cartão</th>
                  <th className="px-4 py-2 font-bold">Último nome</th>
                  <th className="px-4 py-2 font-bold">Tipo</th>
                  <th className="px-4 py-2 text-right font-bold">Fraudes</th>
                </tr>
              </thead>
              <tbody>
                {reincidentes.map((c) => (
                  <tr key={c.codigo_cartao} className="border-t border-slate-100">
                    <td className="px-4 py-2 font-black text-slate-800">{c.codigo_cartao}</td>
                    <td className="px-4 py-2 text-slate-700">{c.ultimo_nome || "-"}</td>
                    <td className="px-4 py-2 text-xs text-slate-500">{c.tipo_cartao || "-"}</td>
                    <td className="px-4 py-2 text-right"><span className="rounded-full bg-rose-100 px-2.5 py-0.5 font-black text-rose-700">{num(c.ocorrencias)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </MonitoramentoSection>
    </MonitoramentoFrame>
  );
}
