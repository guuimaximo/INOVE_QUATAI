import { useEffect, useMemo, useState } from "react";
import { FaCar, FaSearch, FaWrench } from "react-icons/fa";
import { supabase } from "../../supabase";
import { MonitoramentoFrame, MonitoramentoSection, MonitoramentoStatCard } from "./MonitoramentoShell";

function normalizeText(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function formatNumber(value) {
  if (value === null || value === undefined || value === "") return "-";
  const n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString("pt-BR") : String(value);
}

function actionTone(action = "") {
  const text = normalizeText(action);
  if (text.includes("abaixar") || text.includes("subir") || text.includes("mover") || text.includes("revisar")) return "amber";
  if (text.includes("sem ajuste")) return "emerald";
  if (text.includes("inconsistencia")) return "rose";
  return "slate";
}

function problemTone(problem = "") {
  const text = normalizeText(problem);
  if (text.includes("inconsistencia")) return "rose";
  if (text.includes("rosto muito") || text.includes("enquadramento") || text.includes("imagem ruim")) return "amber";
  if (text.includes("sem ajuste")) return "emerald";
  return "slate";
}

function Metric({ label, value, tone = "slate" }) {
  const tones = {
    blue: "border-blue-100 bg-blue-50 text-blue-700",
    emerald: "border-emerald-100 bg-emerald-50 text-emerald-700",
    amber: "border-amber-100 bg-amber-50 text-amber-700",
    rose: "border-rose-100 bg-rose-50 text-rose-700",
    slate: "border-slate-100 bg-slate-50 text-slate-700",
  };

  return (
    <div className={`rounded-2xl border p-3 ${tones[tone] || tones.slate}`}>
      <p className="text-[10px] font-black uppercase tracking-[0.18em] opacity-80">{label}</p>
      <p className="mt-1 text-[17px] font-black leading-tight text-slate-900">{value ?? "-"}</p>
    </div>
  );
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
          [
            "prefixo",
            "total_laudos",
            "total_com_problema_camera",
            "total_rosto_muito_abaixo",
            "total_rosto_muito_acima",
            "total_rosto_muito_esquerda",
            "total_rosto_muito_direita",
            "total_enquadramento_ruim",
            "total_qualidade_ruim",
            "total_area_pequena",
            "total_inconclusivo",
            "total_tecnica",
            "score_medio",
            "ultimo_evento",
            "ultima_categoria",
            "ultima_acao_prevista",
            "ultima_camera_enquadramento",
            "ultima_camera_posicao",
            "ultima_camera_area_rosto_percentual",
            "ultima_qualidade_camera",
            "ultima_recomendacao_camera",
            "ultima_descricao_profissional",
            "problema_principal",
            "acao_sugerida",
            "prioridade_camera",
            "necessita_ajuste_camera",
          ].join(",")
        )
        .order("prioridade_camera", { ascending: false })
        .order("total_com_problema_camera", { ascending: false })
        .order("total_laudos", { ascending: false });

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

  const filteredRows = useMemo(() => {
    const q = normalizeText(search);
    return [...rows].filter((row) => {
      if (!q) return true;
      return normalizeText(
        [
          row.prefixo,
          row.problema_principal,
          row.acao_sugerida,
          row.ultima_recomendacao_camera,
          row.ultima_categoria,
          row.ultima_acao_prevista,
          row.ultima_descricao_profissional,
        ]
          .filter(Boolean)
          .join(" ")
      ).includes(q);
    });
  }, [rows, search]);

  const stats = useMemo(() => {
    const total = rows.length;
    const comAjuste = rows.filter((row) => Boolean(row.necessita_ajuste_camera)).length;
    const problemas = rows.reduce((sum, row) => sum + Number(row.total_com_problema_camera || 0), 0);
    const prioridadeMax = rows.length ? Math.max(...rows.map((row) => Number(row.prioridade_camera || 0))) : 0;

    return { total, comAjuste, problemas, prioridadeMax };
  }, [rows]);

  return (
    <MonitoramentoFrame
      title="Veículos"
      icon={<FaCar className="text-lg" />}
      activeTab="veiculos"
      description="Fila dos carros que precisam de ajuste de câmera com base nos últimos 200 laudos por prefixo. Aqui a leitura vira ação prática."
    >
      <MonitoramentoSection title="Resumo da fila" subtitle="O objetivo é mostrar em qual carro mexer e o que mexer">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <MonitoramentoStatCard title="Veículos" value={formatNumber(stats.total)} tone="blue" />
          <MonitoramentoStatCard title="Com ajuste" value={formatNumber(stats.comAjuste)} tone="amber" />
          <MonitoramentoStatCard title="Laudos com problema" value={formatNumber(stats.problemas)} tone="rose" />
          <MonitoramentoStatCard title="Prioridade máxima" value={formatNumber(stats.prioridadeMax)} tone="emerald" />
        </div>
      </MonitoramentoSection>

      <MonitoramentoSection
        title="Fila de ajuste"
        subtitle="Cada cartão responde: qual carro, qual problema principal e qual ajuste fazer"
        actions={
          <label className="relative block w-full min-w-[280px] md:w-[360px]">
            <FaSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar prefixo, problema ou ação..."
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm font-semibold outline-none transition focus:border-blue-400 focus:bg-white"
            />
          </label>
        }
      >
        {loading ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-14 text-center text-sm font-semibold text-slate-400">
            Carregando fila de veículos...
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-14 text-center">
            <p className="text-sm font-semibold text-slate-700">Nenhum veículo encontrado.</p>
            <p className="mt-1 text-sm text-slate-500">Verifique se a view dos veículos já foi criada no banco.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredRows.map((row) => {
              const problemToneName = problemTone(row.problema_principal);
              const actionToneName = actionTone(row.acao_sugerida);
              const needsFix = Boolean(row.necessita_ajuste_camera);

              return (
                <article
                  key={row.prefixo}
                  className={`rounded-[20px] border p-4 shadow-sm ${
                    needsFix ? "border-amber-200 bg-amber-50/25" : "border-emerald-200 bg-emerald-50/20"
                  }`}
                >
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-xl font-black tracking-tight text-slate-900">{row.prefixo || "SEM PREFIXO"}</h3>
                          <span
                            className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-black ${
                              needsFix ? "border-amber-200 bg-amber-50 text-amber-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"
                            }`}
                          >
                            <FaWrench className="mr-1" />
                            {needsFix ? "precisa ajuste" : "sem ajuste claro"}
                          </span>
                          <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-black text-slate-600">
                            prioridade {formatNumber(row.prioridade_camera)}
                          </span>
                        </div>

                        <p className="mt-1 text-sm text-slate-500">
                          Base: {formatNumber(row.total_laudos)} laudos analisados | {formatNumber(row.total_com_problema_camera)} com problema
                        </p>
                      </div>

                      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                        <Metric label="Rosto muito embaixo" value={formatNumber(row.total_rosto_muito_abaixo)} tone="amber" />
                        <Metric label="Rosto muito em cima" value={formatNumber(row.total_rosto_muito_acima)} tone="amber" />
                        <Metric label="Rosto à esquerda" value={formatNumber(row.total_rosto_muito_esquerda)} tone="amber" />
                        <Metric label="Rosto à direita" value={formatNumber(row.total_rosto_muito_direita)} tone="amber" />
                      </div>
                    </div>

                    <div className="grid gap-2 lg:grid-cols-[1.15fr_0.85fr]">
                      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                        <Metric label="Problema principal" value={row.problema_principal || "-"} tone={problemToneName} />
                        <Metric label="Ação sugerida" value={row.acao_sugerida || "-"} tone={actionToneName} />
                        <Metric label="Enquadramento" value={row.ultima_camera_enquadramento || "-"} tone="slate" />
                        <Metric
                          label="Área do rosto"
                          value={row.ultima_camera_area_rosto_percentual != null ? `${row.ultima_camera_area_rosto_percentual}%` : "-"}
                          tone="slate"
                        />
                      </div>

                      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                        <Metric label="Qualidade" value={row.ultima_qualidade_camera || "-"} tone="slate" />
                        <Metric label="Última ação" value={row.ultima_acao_prevista || "-"} tone="slate" />
                        <Metric label="Última leitura" value={row.ultimo_evento || "-"} tone="slate" />
                        <Metric label="Score médio" value={formatNumber(row.score_medio)} tone="emerald" />
                      </div>
                    </div>

                    <div className="grid gap-2 md:grid-cols-[1fr_1fr]">
                      {row.ultima_recomendacao_camera ? (
                        <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2">
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Leitura do bot</p>
                          <p className="mt-1 text-sm font-semibold text-slate-700">{row.ultima_recomendacao_camera}</p>
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2">
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Leitura do bot</p>
                          <p className="mt-1 text-sm font-semibold text-slate-700">Sem recomendação registrada.</p>
                        </div>
                      )}

                      {row.ultima_descricao_profissional ? (
                        <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2">
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Resumo técnico</p>
                          <p className="mt-1 text-sm font-semibold text-slate-700">{row.ultima_descricao_profissional}</p>
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2">
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Resumo técnico</p>
                          <p className="mt-1 text-sm font-semibold text-slate-700">Sem resumo técnico registrado.</p>
                        </div>
                      )}
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
