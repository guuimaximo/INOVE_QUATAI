// src/components/desempenho/ModalCheckpointAnalise.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  FaChartLine,
  FaTimes,
  FaFilePdf,
  FaSync,
} from "react-icons/fa";
import { supabase } from "../../supabase";

function titleFromTipo(tipo) {
  if (tipo === "PRONTUARIO_10") return "Checkpoint 10 dias";
  if (tipo === "PRONTUARIO_20") return "Checkpoint 20 dias";
  if (tipo === "PRONTUARIO_30") return "Checkpoint 30 dias";
  return "Checkpoint";
}

function eventTypeFromTipo(tipo) {
  return tipo;
}

function formatarDataHoraBR(val, isApenasData = false) {
  if (!val) return "-";
  try {
    if (isApenasData) {
      const str = String(val).split("T")[0].split(" ")[0];
      const parts = str.split("-");
      if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
      return str;
    }
    return new Date(val).toLocaleDateString("pt-BR", {
      timeZone: "America/Sao_Paulo",
    });
  } catch {
    return String(val);
  }
}

function cardClass(delta, invert = false) {
  if (delta == null) return "text-slate-700";
  if (!invert) {
    return delta > 0
      ? "text-emerald-700"
      : delta < 0
      ? "text-rose-700"
      : "text-slate-700";
  }
  return delta < 0
    ? "text-emerald-700"
    : delta > 0
    ? "text-rose-700"
    : "text-slate-700";
}

function inferWindowDays(tipo) {
  if (tipo === "PRONTUARIO_10") return 10;
  if (tipo === "PRONTUARIO_20") return 20;
  if (tipo === "PRONTUARIO_30") return 30;
  return 10;
}

function n(v) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function buildEmptyComp() {
  return {
    antes: { km: 0, litros: 0, kml: 0, meta: 0, desperdicio: 0 },
    depois: { km: 0, litros: 0, kml: 0, meta: 0, desperdicio: 0 },
    delta_kml: 0,
    delta_desp: 0,
  };
}

export default function ModalCheckpointAnalise({
  item,
  checkpointTipo,
  onClose,
}) {
  const [loading, setLoading] = useState(false);
  const [evento, setEvento] = useState(null);
  const [comp, setComp] = useState(buildEmptyComp());

  useEffect(() => {
    async function carregarEvento() {
      setLoading(true);
      try {
        const tipo = eventTypeFromTipo(checkpointTipo);

        const { data, error } = await supabase
          .from("diesel_acompanhamento_eventos")
          .select("*")
          .eq("acompanhamento_id", item.id)
          .eq("tipo", tipo)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) throw error;

        setEvento(data || null);

        const extra = data?.extra || {};
        const comparativo = extra?.comparativo || null;

        if (comparativo) {
          setComp({
            antes: {
              km: n(comparativo?.antes_periodo?.km),
              litros: n(comparativo?.antes_periodo?.litros),
              kml: n(comparativo?.antes_periodo?.kml_real),
              meta: n(comparativo?.antes_periodo?.kml_meta),
              desperdicio: n(comparativo?.antes_periodo?.desperdicio),
            },
            depois: {
              km: n(comparativo?.depois_periodo?.km),
              litros: n(comparativo?.depois_periodo?.litros),
              kml: n(comparativo?.depois_periodo?.kml_real),
              meta: n(comparativo?.depois_periodo?.kml_meta),
              desperdicio: n(comparativo?.depois_periodo?.desperdicio),
            },
            delta_kml: n(comparativo?.delta_kml),
            delta_desp: n(comparativo?.delta_desperdicio),
          });
        } else {
          setComp(buildEmptyComp());
        }
      } catch (e) {
        console.error("Erro ao carregar checkpoint:", e);
        setEvento(null);
        setComp(buildEmptyComp());
      } finally {
        setLoading(false);
      }
    }

    if (item?.id && checkpointTipo) {
      carregarEvento();
    }
  }, [item, checkpointTipo]);

  const windowDays = useMemo(
    () => inferWindowDays(checkpointTipo),
    [checkpointTipo]
  );

  const pdfUrl = useMemo(() => {
    const arr = evento?.evidencias_urls || [];
    const pdf = arr.find((x) => String(x || "").toLowerCase().includes(".pdf"));
    return pdf || null;
  }, [evento]);

  const htmlUrl = useMemo(() => {
    const arr = evento?.evidencias_urls || [];
    const html = arr.find((x) =>
      String(x || "").toLowerCase().includes(".html")
    );
    return html || null;
  }, [evento]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-5 border-b bg-slate-50 sticky top-0 z-10">
          <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
            <FaChartLine className="text-violet-600" />
            {titleFromTipo(checkpointTipo)}
          </h3>

          <div className="flex items-center gap-2">
            {pdfUrl && (
              <a
                href={pdfUrl}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-2 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold inline-flex items-center gap-2"
              >
                <FaFilePdf /> PDF
              </a>
            )}

            {htmlUrl && (
              <a
                href={htmlUrl}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-2 rounded-lg bg-slate-50 text-slate-700 border border-slate-200 text-xs font-bold inline-flex items-center gap-2"
              >
                HTML
              </a>
            )}

            <button onClick={onClose}>
              <FaTimes className="text-gray-400 hover:text-red-500 text-xl" />
            </button>
          </div>
        </div>

        <div className="p-4 md:p-6 space-y-6">
          <div className="p-4 bg-slate-100 rounded-lg border flex flex-col md:flex-row justify-between gap-4">
            <div>
              <div className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">
                Motorista
              </div>
              <div className="font-black text-slate-800 text-lg">
                {item?.motorista_nome || "-"}
              </div>
              <div className="font-mono text-slate-500 text-sm">
                {item?.motorista_chapa || "-"}
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="bg-white rounded-lg border px-3 py-2">
                <div className="text-[10px] font-bold text-slate-500 uppercase">
                  Janela
                </div>
                <div className="text-sm font-black text-slate-700">
                  {windowDays} dias
                </div>
              </div>

              <div className="bg-white rounded-lg border px-3 py-2">
                <div className="text-[10px] font-bold text-slate-500 uppercase">
                  Gerado em
                </div>
                <div className="text-sm font-black text-slate-700">
                  {formatarDataHoraBR(evento?.created_at, false)}
                </div>
              </div>

              <div className="bg-white rounded-lg border px-3 py-2">
                <div className="text-[10px] font-bold text-slate-500 uppercase">
                  Evento
                </div>
                <div className="text-sm font-black text-slate-700">
                  {evento?.tipo || checkpointTipo}
                </div>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="p-8 text-center text-slate-500 font-bold flex items-center justify-center gap-2">
              <FaSync className="animate-spin" /> Carregando análise...
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-xl border shadow-sm">
                  <div className="text-sm text-gray-500 font-bold">KM/L Antes</div>
                  <div className="text-2xl font-black text-slate-800">
                    {comp.antes.kml.toFixed(2)}
                  </div>
                </div>

                <div className="bg-white p-4 rounded-xl border shadow-sm">
                  <div className="text-sm text-gray-500 font-bold">KM/L Depois</div>
                  <div className="text-2xl font-black text-slate-800">
                    {comp.depois.kml.toFixed(2)}
                  </div>
                </div>

                <div className="bg-white p-4 rounded-xl border shadow-sm">
                  <div className="text-sm text-gray-500 font-bold">Delta KM/L</div>
                  <div
                    className={`text-2xl font-black ${cardClass(comp.delta_kml)}`}
                  >
                    {comp.delta_kml >= 0 ? "+" : ""}
                    {comp.delta_kml.toFixed(2)}
                  </div>
                </div>

                <div className="bg-white p-4 rounded-xl border shadow-sm">
                  <div className="text-sm text-gray-500 font-bold">
                    Delta Desperdício
                  </div>
                  <div
                    className={`text-2xl font-black ${cardClass(
                      comp.delta_desp,
                      true
                    )}`}
                  >
                    {comp.delta_desp >= 0 ? "+" : ""}
                    {comp.delta_desp.toFixed(1)} L
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl border shadow-sm overflow-x-auto">
                <table className="w-full text-left min-w-[720px]">
                  <thead className="bg-slate-50 text-slate-600 font-extrabold border-b text-xs uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3">Período</th>
                      <th className="px-4 py-3 text-right">KM</th>
                      <th className="px-4 py-3 text-right">Litros</th>
                      <th className="px-4 py-3 text-right">KM/L Real</th>
                      <th className="px-4 py-3 text-right">KM/L Meta</th>
                      <th className="px-4 py-3 text-right">Desperdício</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    <tr>
                      <td className="px-4 py-3 font-black text-slate-700">
                        Antes
                      </td>
                      <td className="px-4 py-3 text-right">
                        {comp.antes.km.toFixed(0)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {comp.antes.litros.toFixed(0)}
                      </td>
                      <td className="px-4 py-3 text-right font-bold">
                        {comp.antes.kml.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {comp.antes.meta.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right font-bold">
                        {comp.antes.desperdicio.toFixed(1)} L
                      </td>
                    </tr>

                    <tr>
                      <td className="px-4 py-3 font-black text-slate-700">
                        Depois
                      </td>
                      <td className="px-4 py-3 text-right">
                        {comp.depois.km.toFixed(0)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {comp.depois.litros.toFixed(0)}
                      </td>
                      <td className="px-4 py-3 text-right font-bold">
                        {comp.depois.kml.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {comp.depois.meta.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right font-bold">
                        {comp.depois.desperdicio.toFixed(1)} L
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="border rounded-xl p-4 bg-slate-50 shadow-sm">
                <div className="font-bold text-slate-800 mb-2">
                  Observações da Etapa
                </div>
                <div className="text-sm text-slate-600 leading-relaxed">
                  {evento?.observacoes || "Sem observação registrada para esta etapa."}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
