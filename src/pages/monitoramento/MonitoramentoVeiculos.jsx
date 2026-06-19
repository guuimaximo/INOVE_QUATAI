import { useEffect, useMemo, useState } from "react";
import { FaCar, FaExclamationTriangle, FaSearch } from "react-icons/fa";
import { supabase } from "../../supabase";
import { MonitoramentoFrame, MonitoramentoSection, MonitoramentoStatCard } from "./MonitoramentoShell";

function normalizeText(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function scoreAtencao(item) {
  const tecnica = Number(item.total_tecnica || 0);
  const inconclusivo = Number(item.total_inconclusivo || 0);
  const irregularidade = Number(item.total_irregularidade || 0);
  const media = Number(item.score_medio || 0);
  const face = Number(item.score_medio_face_mesh || 0);

  return tecnica * 4 + inconclusivo * 3 + irregularidade * 2 + (media > 0 && media < 70 ? 3 : 0) + (face > 0 && face < 0.6 ? 2 : 0);
}

function toneByIssue(item) {
  if (Number(item.total_tecnica || 0) > 0) return "slate";
  if (Number(item.total_inconclusivo || 0) > 0) return "amber";
  if (Number(item.total_irregularidade || 0) > 0) return "rose";
  return "emerald";
}

export default function MonitoramentoVeiculos() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("vw_monitoramento_inspecoes_veiculos")
        .select(
          "prefixo,total_laudos,total_similaridade,total_irregularidade,total_inconclusivo,total_tecnica,total_rostos_camera,score_medio,score_medio_biometrico,score_medio_face_mesh,ultimo_evento,ultima_acao_prevista,ultima_categoria,ultima_descricao"
        );

      if (!alive) return;

      if (error) {
        console.error("Erro ao carregar veículos do monitoramento:", error);
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

  const orderedRows = useMemo(() => {
    const q = normalizeText(search);
    return [...rows]
      .filter((row) => {
        if (!q) return true;
        return normalizeText([row.prefixo, row.ultima_descricao, row.ultima_acao_prevista, row.ultima_categoria].filter(Boolean).join(" ")).includes(q);
      })
      .sort((a, b) => scoreAtencao(b) - scoreAtencao(a));
  }, [rows, search]);

  const stats = useMemo(() => {
    const total = rows.length;
    const comAjuste = rows.filter((row) => scoreAtencao(row) > 0).length;
    const tecnicas = rows.reduce((sum, row) => sum + Number(row.total_tecnica || 0), 0);
    const inconclusivos = rows.reduce((sum, row) => sum + Number(row.total_inconclusivo || 0), 0);
    const validScores = rows.filter((row) => Number(row.score_medio || 0) > 0);
    const scoreMedio = validScores.length
      ? (validScores.reduce((sum, row) => sum + Number(row.score_medio || 0), 0) / validScores.length).toFixed(1)
      : "0.0";

    return { total, comAjuste, tecnicas, inconclusivos, scoreMedio };
  }, [rows]);

  return (
    <MonitoramentoFrame
      title="Veículos"
      icon={<FaCar className="text-lg" />}
      activeTab="veiculos"
      description="Resumo dos prefixos que mais concentram laudos com indício de ajuste de câmera, com prioridade por ocorrências técnicas."
    >
      <MonitoramentoSection title="Resumo dos veículos" subtitle="Os cartões abaixo ajudam a enxergar rapidamente onde mexer primeiro">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <MonitoramentoStatCard title="Veículos analisados" value={stats.total.toLocaleString("pt-BR")} tone="blue" />
          <MonitoramentoStatCard title="Com ajuste" value={stats.comAjuste.toLocaleString("pt-BR")} tone="amber" />
          <MonitoramentoStatCard title="Ocorrências técnicas" value={stats.tecnicas.toLocaleString("pt-BR")} tone="slate" />
          <MonitoramentoStatCard title="Score médio" value={stats.scoreMedio} tone="emerald" />
        </div>
      </MonitoramentoSection>

      <MonitoramentoSection
        title="Lista priorizada"
        subtitle="Ordenada do maior risco para o menor"
        actions={
          <label className="relative block w-full min-w-[280px] md:w-[360px]">
            <FaSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar prefixo, categoria ou última ação..."
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm font-semibold outline-none transition focus:border-blue-400 focus:bg-white"
            />
          </label>
        }
      >
        {loading ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-14 text-center text-sm font-semibold text-slate-400">
            Carregando veículos...
          </div>
        ) : orderedRows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-14 text-center">
            <p className="text-sm font-semibold text-slate-700">Nenhum veículo encontrado.</p>
            <p className="mt-1 text-sm text-slate-500">Tente outro termo ou verifique se há dados na view de veículos.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {orderedRows.map((row) => {
              const tone = toneByIssue(row);
              const priority = scoreAtencao(row);

              return (
                <article key={row.prefixo} className="rounded-[20px] border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-black tracking-tight text-slate-900">{row.prefixo || "SEM PREFIXO"}</h3>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-black ${
                            tone === "emerald"
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : tone === "amber"
                              ? "border-amber-200 bg-amber-50 text-amber-700"
                              : tone === "rose"
                              ? "border-rose-200 bg-rose-50 text-rose-700"
                              : "border-slate-200 bg-slate-50 text-slate-700"
                          }`}
                        >
                          <FaExclamationTriangle /> prioridade {priority}
                        </span>
                      </div>

                      <p className="mt-1 text-sm text-slate-500">
                        Última leitura: {row.ultimo_evento || "-"} | {row.ultima_categoria || "-"} | {row.ultima_acao_prevista || "-"}
                      </p>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                      <InfoMini label="Laudos" value={row.total_laudos} />
                      <InfoMini label="Técnica" value={row.total_tecnica} tone="slate" />
                      <InfoMini label="Inconclusivo" value={row.total_inconclusivo} tone="amber" />
                      <InfoMini label="Irregularidade" value={row.total_irregularidade} tone="rose" />
                      <InfoMini label="Score" value={row.score_medio || "-"} tone="emerald" />
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </MonitoramentoSection>
    </MonitoramentoFrame>
  );
}

function InfoMini({ label, value, tone = "blue" }) {
  const colors = {
    blue: "border-blue-100 bg-blue-50 text-blue-700",
    emerald: "border-emerald-100 bg-emerald-50 text-emerald-700",
    amber: "border-amber-100 bg-amber-50 text-amber-700",
    rose: "border-rose-100 bg-rose-50 text-rose-700",
    slate: "border-slate-100 bg-slate-50 text-slate-700",
  };

  return (
    <div className={`min-w-[112px] rounded-2xl border p-3 ${colors[tone] || colors.blue}`}>
      <p className="text-[10px] font-black uppercase tracking-[0.18em] opacity-80">{label}</p>
      <p className="mt-1 text-lg font-black text-slate-900">{value ?? "-"}</p>
    </div>
  );
}
