import React, { useEffect, useMemo, useState } from "react";
import {
  FaChartLine,
  FaCheckCircle,
  FaExclamationTriangle,
  FaSync,
} from "react-icons/fa";
import { supabase } from "../../supabase";

function n(v) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function normalizeStatus(s) {
  const st = String(s || "").toUpperCase().trim();
  if (!st) return "AGUARDANDO_INSTRUTOR";
  if (st === "AGUARDANDO INSTRUTOR") return "AGUARDANDO_INSTRUTOR";
  if (st === "CONCLUIDO") return "OK";
  if (st === "TRATATIVA") return "ATAS";
  return st;
}

function buildEmptyResumo() {
  return {
    meta: 0,
    realizado: 0,
    evolucao: 0,
    desperdicio: 0,
    periodoInicio: null,
    periodoFim: null,
    observacoes: "",
    tipoEvento: null,
  };
}

function pickMelhorEvento(eventos = []) {
  if (!Array.isArray(eventos) || eventos.length === 0) return null;

  const peso = {
    PRONTUARIO_30: 3,
    PRONTUARIO_20: 2,
    PRONTUARIO_10: 1,
    ANALISE_FINAL: 0,
  };

  return [...eventos].sort((a, b) => {
    const pa = peso[String(a?.tipo || "").toUpperCase()] ?? -1;
    const pb = peso[String(b?.tipo || "").toUpperCase()] ?? -1;
    if (pa !== pb) return pb - pa;

    const da = new Date(a?.created_at || 0).getTime();
    const db = new Date(b?.created_at || 0).getTime();
    return db - da;
  })[0];
}

export default function ResumoAnalise({ item }) {
  const [loading, setLoading] = useState(false);
  const [resumo, setResumo] = useState(buildEmptyResumo());

  useEffect(() => {
    async function carregarResumo() {
      if (!item?.id) {
        setResumo(buildEmptyResumo());
        return;
      }

      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("diesel_acompanhamento_eventos")
          .select("tipo, created_at, observacoes, extra")
          .eq("acompanhamento_id", item.id)
          .in("tipo", ["PRONTUARIO_10", "PRONTUARIO_20", "PRONTUARIO_30", "ANALISE_FINAL"])
          .order("created_at", { ascending: false });

        if (error) throw error;

        const evento = pickMelhorEvento(data || []);
        if (!evento) {
          setResumo(buildEmptyResumo());
          return;
        }

        const comp = evento?.extra?.comparativo || null;

        if (comp) {
          const meta = n(comp?.depois_periodo?.kml_meta);
          const realizado = n(comp?.depois_periodo?.kml_real);
          const desperdicio = n(comp?.depois_periodo?.desperdicio);
          const evolucao =
            realizado > 0 && n(comp?.antes_periodo?.kml_real) > 0
              ? ((realizado - n(comp?.antes_periodo?.kml_real)) /
                  n(comp?.antes_periodo?.kml_real)) *
                100
              : 0;

          setResumo({
            meta,
            realizado,
            evolucao,
            desperdicio,
            periodoInicio:
              comp?.depois_periodo?.inicio ||
              item?.dt_inicio_monitoramento ||
              null,
            periodoFim:
              comp?.depois_periodo?.fim ||
              item?.dt_fim_previsao ||
              null,
            observacoes: evento?.observacoes || item?.intervencao_obs || "",
            tipoEvento: evento?.tipo || null,
          });
        } else {
          setResumo({
            meta: n(item?.kml_meta),
            realizado: n(item?.kml_final_realizado),
            evolucao: n(item?.evolucao_pct),
            desperdicio: n(item?.desperdicio_final_litros),
            periodoInicio: item?.dt_inicio_monitoramento || null,
            periodoFim: item?.dt_fim_previsao || null,
            observacoes: item?.intervencao_obs || "",
            tipoEvento: evento?.tipo || null,
          });
        }
      } catch (e) {
        console.error("Erro ao carregar resumo da análise:", e);
        setResumo({
          meta: n(item?.kml_meta),
          realizado: n(item?.kml_final_realizado),
          evolucao: n(item?.evolucao_pct),
          desperdicio: n(item?.desperdicio_final_litros),
          periodoInicio: item?.dt_inicio_monitoramento || null,
          periodoFim: item?.dt_fim_previsao || null,
          observacoes: item?.intervencao_obs || "",
          tipoEvento: null,
        });
      } finally {
        setLoading(false);
      }
    }

    carregarResumo();
  }, [item]);

  const statusNorm = useMemo(
    () => normalizeStatus(item?.status_ciclo || item?.status),
    [item]
  );

  const isAtas = statusNorm === "ATAS";
  const isOk = statusNorm === "OK" || statusNorm === "ENCERRADO";
  const badgeClass = isAtas
    ? "bg-rose-50 text-rose-700 border-rose-200"
    : "bg-emerald-50 text-emerald-700 border-emerald-200";

  const badgeText = isAtas
    ? "ENCAMINHADO PARA TRATATIVA"
    : isOk
    ? "META ATINGIDA (ENCERRADO)"
    : "RESULTADO DA ANÁLISE";

  if (!item) return null;

  return (
    <div className="p-4 rounded-xl border bg-white space-y-6">
      <div className="flex items-start justify-between border-b pb-4">
        <div>
          <h4 className="text-sm font-extrabold text-slate-800 flex items-center gap-2 uppercase">
            <FaChartLine className="text-indigo-600" /> Resultado do Monitoramento
          </h4>
          <p className="text-xs text-slate-500 mt-1">
            Período avaliado: {resumo.periodoInicio || "—"} até {resumo.periodoFim || "—"}
          </p>
          {resumo.tipoEvento && (
            <p className="text-[10px] text-slate-400 mt-1 font-bold uppercase">
              Baseado em: {resumo.tipoEvento}
            </p>
          )}
        </div>

        <div
          className={`px-4 py-2 rounded-lg border font-bold text-xs flex items-center gap-2 ${badgeClass}`}
        >
          {isAtas ? <FaExclamationTriangle size={14} /> : <FaCheckCircle size={14} />}
          {badgeText}
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center text-slate-500 font-bold flex items-center justify-center gap-2">
          <FaSync className="animate-spin" /> Carregando resumo...
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-4 rounded-lg border bg-slate-50">
              <div className="text-[10px] font-bold text-slate-500 uppercase">
                Meta (KM/L)
              </div>
              <div className="text-lg font-black text-slate-700">
                {resumo.meta.toFixed(2)}
              </div>
            </div>

            <div className="p-4 rounded-lg border bg-blue-50 border-blue-100">
              <div className="text-[10px] font-bold text-blue-600 uppercase">
                Realizado (KM/L)
              </div>
              <div className="text-lg font-black text-blue-800">
                {resumo.realizado.toFixed(2)}
              </div>
            </div>

            <div
              className={`p-4 rounded-lg border ${
                resumo.evolucao > 0
                  ? "bg-emerald-50 border-emerald-100"
                  : resumo.evolucao < 0
                  ? "bg-rose-50 border-rose-100"
                  : "bg-slate-50 border-slate-100"
              }`}
            >
              <div
                className={`text-[10px] font-bold uppercase ${
                  resumo.evolucao > 0
                    ? "text-emerald-600"
                    : resumo.evolucao < 0
                    ? "text-rose-600"
                    : "text-slate-500"
                }`}
              >
                Evolução
              </div>
              <div
                className={`text-lg font-black ${
                  resumo.evolucao > 0
                    ? "text-emerald-700"
                    : resumo.evolucao < 0
                    ? "text-rose-700"
                    : "text-slate-700"
                }`}
              >
                {resumo.evolucao > 0 ? "+" : ""}
                {resumo.evolucao.toFixed(1)}%
              </div>
            </div>

            <div className="p-4 rounded-lg border bg-amber-50 border-amber-100">
              <div className="text-[10px] font-bold text-amber-700 uppercase">
                Desperdício (L)
              </div>
              <div className="text-lg font-black text-amber-800">
                {resumo.desperdicio.toFixed(1)} L
              </div>
            </div>
          </div>

          <div className="p-4 rounded-lg border bg-gray-50">
            <div className="text-[10px] font-bold text-slate-500 uppercase mb-2">
              Parecer do Instrutor & Log do Sistema
            </div>
            <div className="text-sm text-slate-700 whitespace-pre-wrap font-mono text-[11px] leading-relaxed">
              {resumo.observacoes || "Nenhum log registrado."}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
