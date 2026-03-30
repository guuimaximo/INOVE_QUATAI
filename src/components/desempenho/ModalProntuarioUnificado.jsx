// src/components/desempenho/ModalProntuarioUnificado.jsx
import React, { useEffect, useState, useMemo } from "react";
import {
  FaClipboardList,
  FaTimes,
  FaHistory,
  FaEye,
  FaChartLine,
  FaFilePdf,
  FaArrowRight,
  FaCheckCircle,
  FaExclamationTriangle,
} from "react-icons/fa";
import { supabase } from "../../supabase";
import ResumoLancamentoInstrutor from "./ResumoLancamentoInstrutor";
import ResumoAnalise from "./ResumoAnalise";

function normalizeStatus(s) {
  const st = String(s || "").toUpperCase().trim();
  if (!st) return "AGUARDANDO_INSTRUTOR";
  if (st === "AGUARDANDO INSTRUTOR") return "AGUARDANDO_INSTRUTOR";
  if (st === "CONCLUIDO") return "AGUARDANDO_INSTRUTOR";
  if (st === "AG_ACOMPANHAMENTO") return "AGUARDANDO_INSTRUTOR";
  if (st === "TRATATIVA") return "ATAS";
  return st;
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

function getEtapaLabel(item) {
  const fase = String(item?.fase_monitoramento || "").toUpperCase();
  if (fase === "1_DE_3") return "1 de 3";
  if (fase === "2_DE_3") return "2 de 3";
  if (fase === "3_DE_3") return "3 de 3";
  if (fase === "FIM_MONITORAMENTO") return "Fim";
  return "-";
}

function buildCheckpointCard(label, dataGerada, onClick) {
  const gerado = !!dataGerada;

  return (
    <button
      onClick={onClick}
      className={`text-left border rounded-xl p-4 shadow-sm transition-all hover:shadow-md ${
        gerado
          ? "bg-emerald-50 border-emerald-200"
          : "bg-rose-50 border-rose-200"
      }`}
    >
      <div className="flex justify-between items-center">
        <div className="font-black text-slate-800">{label}</div>
        <FaChartLine className={gerado ? "text-emerald-600" : "text-rose-600"} />
      </div>
      <div className="mt-2 text-xs font-bold">
        {gerado
          ? `Gerado em ${formatarDataHoraBR(dataGerada, false)}`
          : "Pendente"}
      </div>
    </button>
  );
}

function getCheckpointDecisao(item) {
  if (item?.prontuario_pendente) return item.prontuario_pendente;
  if (item?.prontuario_30_gerado_em) return "PRONTUARIO_30";
  if (item?.prontuario_20_gerado_em) return "PRONTUARIO_20";
  if (item?.prontuario_10_gerado_em) return "PRONTUARIO_10";
  return null;
}

export default function ModalProntuarioUnificado({
  item,
  onClose,
  onOpenCheckpoint,
}) {
  const [historico, setHistorico] = useState([]);
  const [loadingHist, setLoadingHist] = useState(false);

  useEffect(() => {
    async function carregarHistorico() {
      setLoadingHist(true);
      try {
        const { data, error } = await supabase
          .from("diesel_acompanhamentos")
          .select("*")
          .eq("motorista_chapa", item.motorista_chapa)
          .neq("id", item.id)
          .order("created_at", { ascending: false })
          .limit(30);

        if (error) throw error;
        setHistorico(data || []);
      } catch {
        setHistorico([]);
      } finally {
        setLoadingHist(false);
      }
    }

    if (item?.motorista_chapa) carregarHistorico();
  }, [item]);

  const statusAtual = normalizeStatus(item?.status_ciclo || item?.status);

  const checkpointDecisao = useMemo(() => getCheckpointDecisao(item), [item]);

  const isAnaliseFinal = ["EM_ANALISE", "OK", "ENCERRADO", "ATAS"].includes(
    statusAtual
  );

  const decisaoInfo = useMemo(() => {
    if (!isAnaliseFinal) return null;

    if (item?.prontuario_pendente) {
      return {
        titulo: "Existe prontuário pendente para decisão",
        texto:
          "Este acompanhamento já está em fase de análise. Abra o checkpoint pendente para decidir se o caso será finalizado ou enviado para tratativa.",
        classe: "bg-amber-50 border-amber-200 text-amber-800",
        icon: <FaExclamationTriangle className="text-amber-600" />,
        cta: "Abrir checkpoint pendente",
      };
    }

    if (checkpointDecisao) {
      return {
        titulo: "Abrir checkpoint para decisão final",
        texto:
          "Use o checkpoint mais recente para decidir se o acompanhamento deve ser encerrado ou encaminhado para tratativa.",
        classe: "bg-violet-50 border-violet-200 text-violet-800",
        icon: <FaCheckCircle className="text-violet-600" />,
        cta: "Abrir checkpoint mais recente",
      };
    }

    return {
      titulo: "Nenhum checkpoint disponível",
      texto:
        "Ainda não existe checkpoint gerado para este acompanhamento. Sem um checkpoint, não há base completa para enviar à tratativa ou finalizar por esta tela.",
      classe: "bg-slate-50 border-slate-200 text-slate-700",
      icon: <FaExclamationTriangle className="text-slate-500" />,
      cta: null,
    };
  }, [isAnaliseFinal, item, checkpointDecisao]);

  const handleAbrirDecisao = () => {
    if (!checkpointDecisao) {
      alert("Nenhum checkpoint disponível para decisão.");
      return;
    }
    onOpenCheckpoint?.(item, checkpointDecisao);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-y-auto flex flex-col">
        <div className="flex justify-between items-center p-5 border-b bg-slate-50 sticky top-0 z-10">
          <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
            <FaClipboardList /> Prontuário Unificado de Acompanhamento
          </h3>
          <button onClick={onClose}>
            <FaTimes className="text-gray-400 hover:text-red-500 text-xl" />
          </button>
        </div>

        <div className="p-4 md:p-6 space-y-6">
          <div className="p-4 bg-slate-100 rounded-lg border flex flex-col lg:flex-row gap-4 justify-between items-start">
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

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 w-full lg:w-auto">
              <div className="bg-white rounded-lg border px-3 py-2">
                <div className="text-[10px] font-bold text-slate-500 uppercase">
                  Foco
                </div>
                <div className="text-sm font-black text-slate-700">
                  {getFoco(item)}
                </div>
              </div>

              <div className="bg-white rounded-lg border px-3 py-2">
                <div className="text-[10px] font-bold text-slate-500 uppercase">
                  Etapa
                </div>
                <div className="text-sm font-black text-slate-700">
                  {getEtapaLabel(item)}
                </div>
              </div>

              <div className="bg-white rounded-lg border px-3 py-2">
                <div className="text-[10px] font-bold text-slate-500 uppercase">
                  Status
                </div>
                <div className="text-sm font-black text-slate-700">
                  {statusAtual}
                </div>
              </div>

              <div className="bg-white rounded-lg border px-3 py-2">
                <div className="text-[10px] font-bold text-slate-500 uppercase">
                  Início
                </div>
                <div className="text-sm font-black text-slate-700">
                  {formatarDataHoraBR(item?.dt_inicio_monitoramento, true)}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2 border rounded-lg p-4 md:p-5 bg-white shadow-sm">
              <h4 className="font-bold text-slate-800 mb-4 border-b pb-2 flex items-center gap-2">
                <FaEye className="text-blue-600" /> Resumo da Ordem Atual
              </h4>

              {statusAtual === "EM_MONITORAMENTO" ? (
                <ResumoLancamentoInstrutor item={item} />
              ) : (
                <ResumoAnalise item={item} />
              )}

              {isAnaliseFinal && decisaoInfo && (
                <div className={`mt-5 border rounded-xl p-4 ${decisaoInfo.classe}`}>
                  <div className="flex items-start gap-3">
                    <div className="text-lg mt-0.5">{decisaoInfo.icon}</div>
                    <div className="flex-1">
                      <div className="font-black text-sm uppercase tracking-wider mb-1">
                        Ações da Análise
                      </div>
                      <div className="font-bold text-base mb-1">
                        {decisaoInfo.titulo}
                      </div>
                      <div className="text-sm leading-relaxed">
                        {decisaoInfo.texto}
                      </div>

                      {decisaoInfo.cta && (
                        <div className="mt-4">
                          <button
                            onClick={handleAbrirDecisao}
                            className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-black shadow-sm hover:bg-slate-800 inline-flex items-center gap-2"
                          >
                            <FaArrowRight /> {decisaoInfo.cta}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="border rounded-lg p-4 md:p-5 bg-slate-50 shadow-sm">
              <h4 className="font-bold text-slate-800 mb-4 border-b pb-2 flex items-center gap-2">
                <FaHistory className="text-slate-500" /> Histórico Pregresso
              </h4>

              {loadingHist ? (
                <div className="text-sm text-slate-500 font-medium">
                  Buscando ocorrências...
                </div>
              ) : historico.length === 0 ? (
                <div className="text-sm text-slate-500 font-medium">
                  Nenhum registro anterior encontrado.
                </div>
              ) : (
                <div className="space-y-3">
                  {historico.map((h) => (
                    <div
                      key={h.id}
                      className="p-3 border rounded-lg bg-white shadow-sm"
                    >
                      <div className="flex justify-between items-start mb-1">
                        <div className="font-bold text-slate-700 text-sm">
                          {formatarDataHoraBR(h.created_at, false)}
                        </div>
                        <div className="font-bold text-[10px] px-2 py-0.5 bg-slate-100 border text-slate-600 rounded">
                          {normalizeStatus(h.status)}
                        </div>
                      </div>
                      <div className="text-xs text-slate-500 leading-relaxed">
                        Foco: {getFoco(h)} <br />
                        Nível: {h.nivel ?? "-"} • Dias: {h.dias_monitoramento ?? "-"}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="border rounded-lg p-4 md:p-5 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b pb-2 mb-4">
              <h4 className="font-bold text-slate-800 flex items-center gap-2">
                <FaChartLine className="text-violet-600" /> Checkpoints Pós-Acompanhamento
              </h4>

              {item?.arquivo_pdf_url && (
                <a
                  href={item.arquivo_pdf_url}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-2 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold inline-flex items-center gap-2"
                >
                  <FaFilePdf /> PDF Inicial
                </a>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {buildCheckpointCard(
                "Checkpoint 10 dias",
                item?.prontuario_10_gerado_em,
                () => onOpenCheckpoint(item, "PRONTUARIO_10")
              )}

              {buildCheckpointCard(
                "Checkpoint 20 dias",
                item?.prontuario_20_gerado_em,
                () => onOpenCheckpoint(item, "PRONTUARIO_20")
              )}

              {buildCheckpointCard(
                "Checkpoint 30 dias",
                item?.prontuario_30_gerado_em,
                () => onOpenCheckpoint(item, "PRONTUARIO_30")
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
