// src/components/desempenho/ModalCheckpointAnalise.jsx
import React, { useEffect, useMemo, useState, useContext } from "react";
import {
  FaChartLine,
  FaTimes,
  FaFilePdf,
  FaSync,
  FaCheckCircle,
  FaExclamationTriangle,
  FaArrowRight,
} from "react-icons/fa";
import { supabase } from "../../supabase";
import { AuthContext } from "../../context/AuthContext";

// =============================================================================
// CONFIG (GitHub Actions)
// =============================================================================
const GH_USER = import.meta.env.VITE_GITHUB_USER;
const GH_REPO = import.meta.env.VITE_GITHUB_REPO;
const GH_TOKEN = import.meta.env.VITE_GITHUB_TOKEN;
const GH_REF = "main";
const WF_TRAT = "ordem-tratativa.yml";

// =============================================================================
// HELPERS
// =============================================================================
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

function getFoco(item) {
  if (item?.motivo) return item.motivo;

  const m = item?.metadata;
  if (m?.foco) return m.foco;

  const cl = m?.cluster_foco;
  const ln = m?.linha_foco;
  if (cl && ln) return `${cl} - Linha ${ln}`;
  if (ln) return `Linha ${ln}`;

  return "Geral";
}

function getLinhaApenas(item) {
  return item?.metadata?.linha_foco || null;
}

function getClusterApenas(item) {
  return item?.metadata?.cluster_foco || null;
}

function getResumoDecisao(comp) {
  const melhorouKml = comp.delta_kml >= 0;
  const reduziuDesperdicio = comp.delta_desp <= 0;

  if (melhorouKml && reduziuDesperdicio) {
    return {
      titulo: "Meta atingida / evolução positiva",
      classe:
        "bg-emerald-50 border-emerald-200 text-emerald-800",
      texto:
        "O checkpoint indica melhora ou manutenção positiva. O acompanhamento já pode ser finalizado, caso a avaliação da gestão esteja de acordo.",
    };
  }

  return {
    titulo: "Desvio mantido / encaminhar tratativa",
    classe: "bg-rose-50 border-rose-200 text-rose-800",
    texto:
      "O checkpoint ainda mostra desvio de performance. O recomendado é encaminhar para tratativa disciplinar com base no prontuário gerado.",
  };
}

async function dispatchGitHubWorkflow(workflowFile, inputs) {
  if (!GH_USER || !GH_REPO || !GH_TOKEN) {
    throw new Error("Credenciais GitHub ausentes.");
  }

  const safeInputs = {};
  for (const key in inputs) {
    safeInputs[key] = String(inputs[key] || "");
  }

  const url = `https://api.github.com/repos/${GH_USER}/${GH_REPO}/actions/workflows/${workflowFile}/dispatches`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${GH_TOKEN}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ref: GH_REF, inputs: safeInputs }),
  });

  if (response.status !== 204) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.message || `Erro GitHub: ${response.status}`);
  }

  return true;
}

// =============================================================================
// COMPONENTE
// =============================================================================
export default function ModalCheckpointAnalise({
  item,
  checkpointTipo,
  onClose,
  onSaved,
}) {
  const { user } = useContext(AuthContext);

  const [loading, setLoading] = useState(false);
  const [evento, setEvento] = useState(null);
  const [comp, setComp] = useState(buildEmptyComp());

  const [actionLoading, setActionLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState({ type: "", text: "" });

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

  const parecer = useMemo(() => getResumoDecisao(comp), [comp]);

  async function atualizarAcompanhamento(status, observacaoEvento) {
    const agora = new Date().toISOString();

    const { error: upErr } = await supabase
      .from("diesel_acompanhamentos")
      .update({
        status,
        updated_at: agora,
      })
      .eq("id", item.id);

    if (upErr) throw upErr;

    const { error: evErr } = await supabase
      .from("diesel_acompanhamento_eventos")
      .insert({
        acompanhamento_id: item.id,
        tipo: "ANALISE_FINAL",
        observacoes: observacaoEvento,
        criado_por_login: user?.login || user?.email || null,
        criado_por_nome:
          user?.nome || user?.nome_completo || user?.email || null,
        extra: {
          origem: "ModalCheckpointAnalise",
          checkpoint_tipo: checkpointTipo,
          delta_kml: comp.delta_kml,
          delta_desperdicio: comp.delta_desp,
        },
      });

    if (evErr) throw evErr;
  }

  async function handleFinalizarAcompanhamento() {
    const confirmar = window.confirm(
      "Confirma a finalização deste acompanhamento?"
    );
    if (!confirmar) return;

    setActionLoading(true);
    setStatusMsg({ type: "info", text: "Finalizando acompanhamento..." });

    try {
      await atualizarAcompanhamento(
        "ENCERRADO",
        `Acompanhamento finalizado manualmente na etapa ${checkpointTipo}. Delta KM/L: ${comp.delta_kml.toFixed(
          2
        )} | Delta Desperdício: ${comp.delta_desp.toFixed(1)} L.`
      );

      setStatusMsg({
        type: "success",
        text: "Acompanhamento finalizado com sucesso.",
      });

      if (typeof onSaved === "function") {
        await onSaved();
      }

      setTimeout(() => {
        onClose?.();
        if (typeof onSaved !== "function") {
          window.location.reload();
        }
      }, 1200);
    } catch (e) {
      console.error(e);
      setStatusMsg({
        type: "error",
        text: e?.message || "Erro ao finalizar acompanhamento.",
      });
    } finally {
      setActionLoading(false);
    }
  }

  async function handleEnviarTratativa() {
    const confirmar = window.confirm(
      "Confirma o envio deste caso para tratativa?"
    );
    if (!confirmar) return;

    setActionLoading(true);
    setStatusMsg({ type: "info", text: "Enviando para tratativa..." });

    try {
      const chapa = String(item?.motorista_chapa || "").trim();
      const nomeMot = String(item?.motorista_nome || "").trim() || null;
      const foco = getFoco(item);
      const linha = getLinhaApenas(item);
      const cluster = getClusterApenas(item);
      const lancadorLogin = user?.login || user?.email || null;
      const lancadorNome =
        user?.nome || user?.nome_completo || user?.email || null;

      // 1) verifica se já existe tratativa pendente
      const { data: tratExistente, error: tratExistenteErr } = await supabase
        .from("diesel_tratativas")
        .select("id, evidencias_urls")
        .eq("motorista_chapa", chapa)
        .eq("tipo_ocorrencia", "DIESEL_KML")
        .ilike("status", "%pendente%")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (tratExistenteErr) throw tratExistenteErr;

      let tratativaId = null;

      if (tratExistente?.id) {
        tratativaId = tratExistente.id;

        const evidAntigas = Array.isArray(tratExistente.evidencias_urls)
          ? tratExistente.evidencias_urls
          : [];
        const novasEvidencias = [
          ...evidAntigas,
          ...((evento?.evidencias_urls || []).filter(Boolean)),
        ];

        const { error: upTratErr } = await supabase
          .from("diesel_tratativas")
          .update({
            evidencias_urls: [...new Set(novasEvidencias)],
          })
          .eq("id", tratativaId);

        if (upTratErr) throw upTratErr;
      } else {
        const descricao = [
          `Encaminhado automaticamente a partir do checkpoint ${checkpointTipo}.`,
          `Foco: ${foco}.`,
          `Meta: ${comp.depois.meta.toFixed(2)} | Real: ${comp.depois.kml.toFixed(
            2
          )}.`,
          `Delta KM/L: ${comp.delta_kml.toFixed(2)}.`,
          `Delta Desperdício: ${comp.delta_desp.toFixed(1)} L.`,
          "",
          evento?.observacoes || "Sem observação adicional.",
        ].join("\n");

        const { data: novaTrat, error: errTrat } = await supabase
          .from("diesel_tratativas")
          .insert({
            motorista_chapa: chapa || null,
            motorista_nome: nomeMot,
            status: "Pendente",
            prioridade: "Alta",
            descricao,
            evidencias_urls: (evento?.evidencias_urls || []).filter(Boolean),
            tipo_ocorrencia: "DIESEL_KML",
            linha: linha || null,
            cluster: cluster || null,
            periodo_inicio: null,
            periodo_fim: null,
            metadata: {
              origem: "CHECKPOINT_ANALISE",
              acompanhamento_id: item.id,
              checkpoint_tipo: checkpointTipo,
              foco,
              kpis: {
                antes: comp.antes,
                depois: comp.depois,
                delta_kml: comp.delta_kml,
                delta_desperdicio: comp.delta_desp,
              },
            },
          })
          .select("id")
          .single();

        if (errTrat) throw errTrat;
        tratativaId = novaTrat.id;
      }

      // 2) detalhe da tratativa
      const { error: tratDetErr } = await supabase
        .from("diesel_tratativas_detalhes")
        .insert({
          tratativa_id: tratativaId,
          acao_aplicada: "ABERTURA_AUTOMATICA",
          observacoes: `Tratativa aberta a partir do ${checkpointTipo}. Foco: ${foco}. Delta KM/L: ${comp.delta_kml.toFixed(
            2
          )} | Delta Desperdício: ${comp.delta_desp.toFixed(1)} L.`,
          tratado_por_login: lancadorLogin,
          tratado_por_nome: lancadorNome,
        });

      if (tratDetErr) throw tratDetErr;

      // 3) lote para prontuário de tratativa
      const { data: lote, error: loteErr } = await supabase
        .from("acompanhamento_lotes")
        .insert({
          status: "PROCESSANDO",
          qtd: 1,
          extra: {
            tipo: "prontuario_tratativa",
            chapa,
            origem: "checkpoint_analise",
            acompanhamento_id: item.id,
          },
        })
        .select("id")
        .single();

      if (loteErr) throw loteErr;

      const { error: itemLoteErr } = await supabase
        .from("acompanhamento_lote_itens")
        .insert([{ lote_id: lote.id, motorista_chapa: chapa }]);

      if (itemLoteErr) throw itemLoteErr;

      // 4) atualiza acompanhamento
      await atualizarAcompanhamento(
        "ATAS",
        `Caso encaminhado para tratativa a partir do ${checkpointTipo}. Tratativa ID: ${tratativaId}.`
      );

      // 5) workflow
      await dispatchGitHubWorkflow(WF_TRAT, {
        ordem_batch_id: String(lote.id),
        qtd: "1",
      });

      setStatusMsg({
        type: "success",
        text: "Caso enviado para tratativa com sucesso.",
      });

      if (typeof onSaved === "function") {
        await onSaved();
      }

      setTimeout(() => {
        onClose?.();
        if (typeof onSaved !== "function") {
          window.location.reload();
        }
      }, 1500);
    } catch (e) {
      console.error(e);
      setStatusMsg({
        type: "error",
        text: e?.message || "Erro ao enviar para tratativa.",
      });
    } finally {
      setActionLoading(false);
    }
  }

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

          {statusMsg.text && (
            <div
              className={`p-4 rounded-xl border flex items-center gap-3 ${
                statusMsg.type === "success"
                  ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                  : statusMsg.type === "error"
                  ? "bg-rose-50 border-rose-200 text-rose-800"
                  : "bg-blue-50 border-blue-200 text-blue-800"
              }`}
            >
              <div className="text-lg">
                {statusMsg.type === "success" ? (
                  <FaCheckCircle />
                ) : statusMsg.type === "error" ? (
                  <FaExclamationTriangle />
                ) : (
                  <FaSync className="animate-spin" />
                )}
              </div>
              <div className="font-bold text-sm">{statusMsg.text}</div>
            </div>
          )}

          {loading ? (
            <div className="p-8 text-center text-slate-500 font-bold flex items-center justify-center gap-2">
              <FaSync className="animate-spin" /> Carregando análise...
            </div>
          ) : (
            <>
              <div className={`border rounded-xl p-4 shadow-sm ${parecer.classe}`}>
                <div className="font-black text-sm uppercase tracking-wider mb-2">
                  Decisão da Etapa
                </div>
                <div className="font-bold text-base mb-1">{parecer.titulo}</div>
                <div className="text-sm leading-relaxed">{parecer.texto}</div>

                <div className="flex flex-wrap gap-3 mt-4">
                  <button
                    onClick={handleFinalizarAcompanhamento}
                    disabled={actionLoading}
                    className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-black shadow-sm hover:bg-emerald-700 disabled:opacity-60 inline-flex items-center gap-2"
                  >
                    <FaCheckCircle /> Finalizar Acompanhamento
                  </button>

                  <button
                    onClick={handleEnviarTratativa}
                    disabled={actionLoading}
                    className="px-4 py-2 rounded-lg bg-rose-600 text-white text-sm font-black shadow-sm hover:bg-rose-700 disabled:opacity-60 inline-flex items-center gap-2"
                  >
                    <FaArrowRight /> Enviar para Tratativa
                  </button>
                </div>
              </div>

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
                  {evento?.observacoes ||
                    "Sem observação registrada para esta etapa."}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
