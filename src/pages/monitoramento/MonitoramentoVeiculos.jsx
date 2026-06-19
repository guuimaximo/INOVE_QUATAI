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

function needsAdjustment(row) {
  return Boolean(row?.necessita_ajuste_camera);
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
          "prefixo,total_laudos,total_ajustes_camera,total_similaridade,total_irregularidade,total_inconclusivo,total_tecnica,score_medio,score_medio_face_mesh,ultimo_evento,ultima_categoria,ultima_acao_prevista,ultima_qualidade_camera,ultima_camera_enquadramento,ultima_camera_posicao,ultima_camera_area_rosto_percentual,ultima_recomendacao_camera,ultima_descricao,prioridade_camera,necessita_ajuste_camera"
        )
        .order("prioridade_camera", { ascending: false })
        .order("total_ajustes_camera", { ascending: false });

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
    return [...rows].filter((row) => {
      if (!q) return true;
      return normalizeText(
        [
          row.prefixo,
          row.ultima_descricao,
          row.ultima_acao_prevista,
          row.ultima_categoria,
          row.ultima_recomendacao_camera,
          row.ultima_camera_enquadramento,
        ]
          .filter(Boolean)
          .join(" ")
      ).includes(q);
    });
  }, [rows, search]);

  const stats = useMemo(() => {
    const total = rows.length;
    const comAjuste = rows.filter((row) => needsAdjustment(row)).length;
    const tecnicas = rows.reduce((sum, row) => sum + Number(row.total_tecnica || 0), 0);
    const ajustes = rows.reduce((sum, row) => sum + Number(row.total_ajustes_camera || 0), 0);
    const validScores = rows.filter((row) => Number(row.score_medio || 0) > 0);
    const scoreMedio = validScores.length
      ? (validScores.reduce((sum, row) => sum + Number(row.score_medio || 0), 0) / validScores.length).toFixed(1)
      : "0.0";

    return { total, comAjuste, tecnicas, ajustes, scoreMedio };
  }, [rows]);

  return (
    <MonitoramentoFrame
      title="Veículos"
      icon={<FaCar className="text-lg" />}
      activeTab="veiculos"
      description="Resumo dos prefixos com indícios de ajuste de câmera e da última leitura técnica do bot."
    >
      <MonitoramentoSection title="Resumo dos veículos" subtitle="Prioridade baseada na última leitura técnica e nos sinais de ajuste de câmera">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <MonitoramentoStatCard title="Veículos" value={stats.total.toLocaleString("pt-BR")} tone="blue" />
          <MonitoramentoStatCard title="Com ajuste" value={stats.comAjuste.toLocaleString("pt-BR")} tone="amber" />
          <MonitoramentoStatCard title="Ajustes" value={stats.ajustes.toLocaleString("pt-BR")} tone="rose" />
          <MonitoramentoStatCard title="Score médio" value={stats.scoreMedio} tone="emerald" />
        </div>
      </MonitoramentoSection>

      <MonitoramentoSection
        title="Lista priorizada"
        subtitle="Veículos com maior necessidade de revisão da câmera primeiro"
        actions={
          <label className="relative block w-full min-w-[280px] md:w-[360px]">
            <FaSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar prefixo, recomendação, categoria..."
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
            <p className="mt-1 text-sm text-slate-500">Verifique se a view de veículos foi criada no banco.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {orderedRows.map((row) => {
              const badgeTone = needsAdjustment(row) ? "amber" : "emerald";

              return (
                <article
                  key={row.prefixo}
                  className={`rounded-[20px] border p-4 shadow-sm ${needsAdjustment(row) ? "border-amber-200 bg-amber-50/30" : "border-slate-200 bg-white"}`}
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-black tracking-tight text-slate-900">{row.prefixo || "SEM PREFIXO"}</h3>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-black ${
                            badgeTone === "amber"
                              ? "border-amber-200 bg-amber-50 text-amber-700"
                              : "border-emerald-200 bg-emerald-50 text-emerald-700"
                          }`}
                        >
                          <FaExclamationTriangle /> prioridade {Number(row.prioridade_camera || 0)}
                        </span>
                      </div>

                      <p className="mt-1 text-sm text-slate-500">
                        Última leitura: {row.ultimo_evento || "-"} | {row.ultima_categoria || "-"} | {row.ultima_acao_prevista || "-"}
                      </p>

                      <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                        <SmallMetric label="Último enquadramento" value={row.ultima_camera_enquadramento || "-"} />
                        <SmallMetric label="Qualidade" value={row.ultima_qualidade_camera || "-"} />
                        <SmallMetric label="Posição do rosto" value={row.ultima_camera_posicao || "-"} />
                        <SmallMetric label="Área do rosto" value={row.ultima_camera_area_rosto_percentual != null ? `${row.ultima_camera_area_rosto_percentual}%` : "-"} />
                      </div>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                      <SmallMetric label="Laudos" value={row.total_laudos} />
                      <SmallMetric label="Técnica" value={row.total_tecnica} tone="slate" />
                      <SmallMetric label="Inconclusivo" value={row.total_inconclusivo} tone="amber" />
                      <SmallMetric label="Irregularidade" value={row.total_irregularidade} tone="rose" />
                      <SmallMetric label="Score" value={row.score_medio || "-"} tone="emerald" />
                    </div>
                  </div>

                  {row.ultima_recomendacao_camera || row.ultima_descricao ? (
                    <div className="mt-4 grid gap-2 md:grid-cols-[1fr_1fr]">
                      {row.ultima_recomendacao_camera ? (
                        <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2">
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Recomendação de câmera</p>
                          <p className="mt-1 text-sm font-semibold text-slate-700">{row.ultima_recomendacao_camera}</p>
                        </div>
                      ) : null}
                      {row.ultima_descricao ? (
                        <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2">
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Última descrição</p>
                          <p className="mt-1 text-sm font-semibold text-slate-700">{row.ultima_descricao}</p>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </MonitoramentoSection>
    </MonitoramentoFrame>
  );
}

function SmallMetric({ label, value, tone = "blue" }) {
  const colors = {
    blue: "border-blue-100 bg-blue-50 text-blue-700",
    emerald: "border-emerald-100 bg-emerald-50 text-emerald-700",
    amber: "border-amber-100 bg-amber-50 text-amber-700",
    rose: "border-rose-100 bg-rose-50 text-rose-700",
    slate: "border-slate-100 bg-slate-50 text-slate-700",
  };

  return (
    <div className={`rounded-2xl border p-3 ${colors[tone] || colors.blue}`}>
      <p className="text-[10px] font-black uppercase tracking-[0.18em] opacity-80">{label}</p>
      <p className="mt-1 text-lg font-black text-slate-900">{value ?? "-"}</p>
    </div>
  );
}
