import React, { useState } from "react";
import { 
  FaTimes, 
  FaChartBar, 
  FaFilePdf, 
  FaCode, 
  FaCheckCircle, 
  FaArrowRight,
  FaInfoCircle
} from "react-icons/fa";

// Função local para garantir segurança matemática e evitar tela branca
function n(v) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

export default function AcompanhamentosModal({
  subAcompanhamento,
  setSubAcompanhamento,
  headerSubAcompanhamento,
  checkpointResumo,
  resumoInstrutor,
  tempoPorDia,
  resumoPorLinhaCheckpoint,
  acompanhamentosComEvolucao,
  fmtNum,
  fmtInt,
  fmtDateBr,
  formatMinutes,
  statusBadgeClass,
  EvolucaoBadge,
}) {
  const [detalheModal, setDetalheModal] = useState(null);

  const tabs = [
    ["RESUMO_INSTRUTOR", "Resumo por Instrutor"],
    ["TEMPO_DIA", "Tempo por Dia"],
    ["CHECKPOINT_LINHA", "Check Point por Linha"],
    ["ACOMPANHAMENTOS", "Acompanhamentos"],
  ];

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border shadow-sm p-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-slate-800">
              {headerSubAcompanhamento[subAcompanhamento]?.titulo || "Acompanhamentos"}
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              {headerSubAcompanhamento[subAcompanhamento]?.subtitulo || ""}
            </p>
          </div>

          <div className="flex flex-wrap bg-slate-100 p-1 rounded-lg gap-1">
            {tabs.map(([key, label]) => (
              <button
                key={key}
                onClick={() => setSubAcompanhamento(key)}
                className={`px-4 py-2 rounded-md text-sm font-bold transition ${
                  subAcompanhamento === key
                    ? "bg-white shadow-sm text-slate-800"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <div className="bg-white p-4 rounded-xl border shadow-sm">
          <p className="text-sm text-gray-500 font-bold">Checkpoints</p>
          <p className="text-2xl font-black text-slate-800">
            {fmtInt(checkpointResumo.total)}
          </p>
        </div>

        <div className="bg-white p-4 rounded-xl border shadow-sm">
          <p className="text-sm text-gray-500 font-bold">Melhoraram KM/L</p>
          <p className="text-2xl font-black text-emerald-700">
            {fmtInt(checkpointResumo.melhoraramKml)}
          </p>
        </div>

        <div className="bg-white p-4 rounded-xl border shadow-sm">
          <p className="text-sm text-gray-500 font-bold">Pioraram KM/L</p>
          <p className="text-2xl font-black text-rose-700">
            {fmtInt(checkpointResumo.pioraramKml)}
          </p>
        </div>

        <div className="bg-white p-4 rounded-xl border shadow-sm">
          <p className="text-sm text-gray-500 font-bold">Reduziram Desp.</p>
          <p className="text-2xl font-black text-emerald-700">
            {fmtInt(checkpointResumo.reduziramDesperdicio)}
          </p>
        </div>

        <div className="bg-white p-4 rounded-xl border shadow-sm">
          <p className="text-sm text-gray-500 font-bold">Aumentaram Desp.</p>
          <p className="text-2xl font-black text-rose-700">
            {fmtInt(checkpointResumo.aumentaramDesperdicio)}
          </p>
        </div>

        <div className="bg-white p-4 rounded-xl border shadow-sm">
          <p className="text-sm text-gray-500 font-bold">Média Δ KM/L</p>
          <p className="text-2xl font-black text-slate-800">
            {fmtNum(checkpointResumo.mediaDeltaKml)}
          </p>
        </div>
      </div>

      {subAcompanhamento === "RESUMO_INSTRUTOR" && (
        <div className="bg-white rounded-xl shadow-sm border overflow-x-auto">
          <table className="w-full text-left min-w-[1100px]">
            <thead className="bg-slate-50 text-slate-600 font-extrabold border-b text-xs md:text-sm uppercase tracking-wider">
              <tr>
                <th className="px-4 py-4">Instrutor</th>
                <th className="px-4 py-4">Acompanhamentos</th>
                <th className="px-4 py-4">Tempo Total</th>
                <th className="px-4 py-4">Tempo Médio</th>
                <th className="px-4 py-4">Em Monitoramento</th>
                <th className="px-4 py-4">Em Análise</th>
                <th className="px-4 py-4">Concluídos</th>
                <th className="px-4 py-4">Linhas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {resumoInstrutor.map((row) => (
                <tr key={row.id} className="hover:bg-blue-50/50 transition-colors">
                  <td className="px-4 py-4 font-black text-slate-900">{row.instrutor_nome}</td>
                  <td className="px-4 py-4">{fmtInt(row.total_acompanhamentos)}</td>
                  <td className="px-4 py-4">{formatMinutes(row.total_minutos)}</td>
                  <td className="px-4 py-4">{formatMinutes(row.media_minutos)}</td>
                  <td className="px-4 py-4">{fmtInt(row.em_monitoramento)}</td>
                  <td className="px-4 py-4">{fmtInt(row.em_analise)}</td>
                  <td className="px-4 py-4">{fmtInt(row.concluidos)}</td>
                  <td className="px-4 py-4">{fmtInt(row.qtd_linhas)}</td>
                </tr>
              ))}
              {resumoInstrutor.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-500 font-bold">
                    Nenhum registro encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {subAcompanhamento === "TEMPO_DIA" && (
        <div className="bg-white rounded-xl shadow-sm border overflow-x-auto">
          <table className="w-full text-left min-w-[1000px]">
            <thead className="bg-slate-50 text-slate-600 font-extrabold border-b text-xs md:text-sm uppercase tracking-wider">
              <tr>
                <th className="px-4 py-4">Data</th>
                <th className="px-4 py-4">Instrutor</th>
                <th className="px-4 py-4">Acompanhamentos</th>
                <th className="px-4 py-4">Tempo Total</th>
                <th className="px-4 py-4">Tempo Médio</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {tempoPorDia.map((row) => (
                <tr key={row.id} className="hover:bg-blue-50/50 transition-colors">
                  <td className="px-4 py-4 font-bold">{fmtDateBr(row.data_ref)}</td>
                  <td className="px-4 py-4">{row.instrutor_nome}</td>
                  <td className="px-4 py-4">{fmtInt(row.total_acompanhamentos)}</td>
                  <td className="px-4 py-4">{formatMinutes(row.total_minutos)}</td>
                  <td className="px-4 py-4">{formatMinutes(row.media_minutos)}</td>
                </tr>
              ))}
              {tempoPorDia.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500 font-bold">
                    Nenhum registro encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {subAcompanhamento === "CHECKPOINT_LINHA" && (
        <div className="bg-white rounded-xl shadow-sm border overflow-x-auto">
          <table className="w-full text-left min-w-[1450px]">
            <thead className="bg-slate-50 text-slate-600 font-extrabold border-b text-xs md:text-sm uppercase tracking-wider">
              <tr>
                <th className="px-4 py-4">Linha</th>
                <th className="px-4 py-4">Prontuário</th>
                <th className="px-4 py-4">Qtd.</th>
                <th className="px-4 py-4">Antes KM/L</th>
                <th className="px-4 py-4">Depois KM/L</th>
                <th className="px-4 py-4">Δ KM/L</th>
                <th className="px-4 py-4">Antes Desp.</th>
                <th className="px-4 py-4">Depois Desp.</th>
                <th className="px-4 py-4">Δ Desp.</th>
                <th className="px-4 py-4">Melhorou</th>
                <th className="px-4 py-4">Piorou</th>
                <th className="px-4 py-4">Ações</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-200">
              {resumoPorLinhaCheckpoint.map((row) => (
                <React.Fragment key={row.id}>
                  <tr className="bg-slate-50 font-semibold border-b">
                    <td className="px-4 py-4 font-black text-slate-900">{row.linha_foco}</td>
                    <td className="px-4 py-4 text-slate-700">{row.tipo}</td>
                    <td className="px-4 py-4 text-slate-700">{fmtInt(row.qtd_motoristas)}</td>
                    <td className="px-4 py-4 text-slate-700">{fmtNum(row.antes_kml)}</td>
                    <td className="px-4 py-4 text-slate-700">{fmtNum(row.depois_kml)}</td>
                    <td className="px-4 py-4">
                      <EvolucaoBadge value={row.delta_kml} />
                    </td>
                    <td className="px-4 py-4 text-slate-700">{fmtNum(row.antes_desp)}</td>
                    <td className="px-4 py-4 text-slate-700">{fmtNum(row.depois_desp)}</td>
                    <td className="px-4 py-4">
                      <EvolucaoBadge value={row.delta_desperdicio} invert />
                    </td>
                    <td className="px-4 py-4 text-emerald-700 font-bold">{fmtInt(row.melhorou)}</td>
                    <td className="px-4 py-4 text-rose-700 font-bold">{fmtInt(row.piorou)}</td>
                    <td className="px-4 py-4"></td>
                  </tr>

                  {row.motoristas && row.motoristas.map((mot, idx) => (
                    <tr key={`${row.id}_mot_${idx}`} className="bg-white hover:bg-blue-50/50 transition-colors text-sm border-b border-gray-100">
                      <td colSpan={3} className="px-4 py-3 pl-8 border-l-4 border-blue-400">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-700">{mot.nome}</span>
                          <button
                            onClick={() => setDetalheModal({ motorista_nome: mot.nome, motorista_chapa: mot.chapa, ...mot })}
                            className="text-blue-500 hover:text-blue-700 transition-colors"
                            title="Entender Memória de Cálculo"
                          >
                            <FaInfoCircle size={16} />
                          </button>
                          <span className="ml-2 text-xs font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                            {mot.chapa}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{mot.antes_kml == null ? "-" : fmtNum(mot.antes_kml)}</td>
                      <td className="px-4 py-3 text-slate-600">{mot.depois_kml == null ? "-" : fmtNum(mot.depois_kml)}</td>
                      <td className="px-4 py-3">
                        {mot.delta_kml == null ? "-" : <EvolucaoBadge value={mot.delta_kml} />}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{mot.antes_desp == null ? "-" : fmtNum(mot.antes_desp)}</td>
                      <td className="px-4 py-3 text-slate-600">{mot.depois_desp == null ? "-" : fmtNum(mot.depois_desp)}</td>
                      <td className="px-4 py-3">
                        {mot.delta_desperdicio == null ? "-" : <EvolucaoBadge value={mot.delta_desperdicio} invert />}
                      </td>
                      <td colSpan={2} className="px-4 py-3">
                        <span className="font-bold text-slate-600 text-xs uppercase tracking-wide">
                          {mot.conclusao || "-"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setDetalheModal({ motorista_nome: mot.nome, motorista_chapa: mot.chapa, ...mot })}
                          className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white rounded-md font-bold transition border border-blue-200 hover:border-blue-600"
                          title="Abrir Análise"
                        >
                          <FaChartBar />
                          Análise
                        </button>
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}
              {resumoPorLinhaCheckpoint.length === 0 && (
                <tr>
                  <td colSpan={12} className="px-6 py-12 text-center text-slate-500 font-bold">
                    Nenhum checkpoint encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {subAcompanhamento === "ACOMPANHAMENTOS" && (
        <div className="bg-white rounded-xl shadow-sm border overflow-x-auto">
          <table className="w-full text-left min-w-[1700px]">
            <thead className="bg-slate-50 text-slate-600 font-extrabold border-b text-xs md:text-sm uppercase tracking-wider">
              <tr>
                <th className="px-4 py-4">Motorista</th>
                <th className="px-4 py-4">Chapa</th>
                <th className="px-4 py-4">Linha</th>
                <th className="px-4 py-4">Instrutor</th>
                <th className="px-4 py-4">Status</th>
                <th className="px-4 py-4">Início</th>
                <th className="px-4 py-4">Tempo</th>
                <th className="px-4 py-4">Prontuário</th>
                <th className="px-4 py-4">Antes KM/L</th>
                <th className="px-4 py-4">Depois KM/L</th>
                <th className="px-4 py-4">Δ KM/L</th>
                <th className="px-4 py-4">Antes Desp.</th>
                <th className="px-4 py-4">Depois Desp.</th>
                <th className="px-4 py-4">Δ Desp.</th>
                <th className="px-4 py-4 text-center">Ações</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {acompanhamentosComEvolucao.map((row) => (
                <tr key={row.id} className="hover:bg-blue-50/50 transition-colors">
                  <td className="px-4 py-4 font-black text-slate-900">
                    <div className="flex items-center gap-2">
                      {row.motorista_nome || "-"}
                      {row.checkpoint_tipo !== "SEM_DADOS" && (
                        <button
                          onClick={() => setDetalheModal(row)}
                          className="text-blue-500 hover:text-blue-700 transition-colors"
                          title="Entender Memória de Cálculo"
                        >
                          <FaInfoCircle size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span className="text-xs text-slate-600 font-mono bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                      {row.motorista_chapa || "-"}
                    </span>
                  </td>
                  <td className="px-4 py-4">{row.linha_resolvida || "-"}</td>
                  <td className="px-4 py-4">{row.instrutor_nome || "-"}</td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex px-2.5 py-1 rounded-lg border text-xs font-bold ${statusBadgeClass(row.status_norm)}`}>
                      {row.status_norm}
                    </span>
                  </td>
                  <td className="px-4 py-4">{fmtDateBr(row.data_ref)}</td>
                  <td className="px-4 py-4">{formatMinutes(row.duracao_min)}</td>
                  <td className="px-4 py-4">{row.checkpoint_tipo || "-"}</td>
                  <td className="px-4 py-4">{row.antes_kml == null ? "-" : fmtNum(row.antes_kml)}</td>
                  <td className="px-4 py-4">{row.depois_kml == null ? "-" : fmtNum(row.depois_kml)}</td>
                  <td className="px-4 py-4">
                    {row.delta_kml == null ? "-" : <EvolucaoBadge value={row.delta_kml} />}
                  </td>
                  <td className="px-4 py-4">{row.antes_desp == null ? "-" : fmtNum(row.antes_desp)}</td>
                  <td className="px-4 py-4">{row.depois_desp == null ? "-" : fmtNum(row.depois_desp)}</td>
                  <td className="px-4 py-4">
                    {row.delta_desperdicio == null ? "-" : (
                      <EvolucaoBadge value={row.delta_desperdicio} invert />
                    )}
                  </td>
                  <td className="px-4 py-4 flex items-center justify-center gap-2">
                    {row.checkpoint_tipo !== "SEM_DADOS" && (
                      <button
                        onClick={() => setDetalheModal(row)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white rounded-md font-bold transition border border-blue-200 hover:border-blue-600"
                        title="Abrir Análise"
                      >
                        <FaChartBar />
                        Análise
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {acompanhamentosComEvolucao.length === 0 && (
                <tr>
                  <td colSpan={15} className="px-6 py-12 text-center text-slate-500 font-bold">
                    Nenhum acompanhamento encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL DETALHE CÁLCULO E REGRAS */}
      {detalheModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-slate-50 w-full max-w-5xl rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
            
            <div className="flex items-center justify-between px-6 py-4 bg-white border-b">
              <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                <FaChartBar className="text-indigo-600" />
                Checkpoint {detalheModal.janela_aplicada || 0} dias
              </h2>
              <div className="flex items-center gap-2">
                <button className="flex items-center gap-2 px-3 py-1.5 bg-rose-50 text-rose-600 border border-rose-200 rounded hover:bg-rose-100 transition text-sm font-bold">
                  <FaFilePdf /> PDF
                </button>
                <button className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 text-slate-600 border border-slate-200 rounded hover:bg-slate-200 transition text-sm font-bold">
                  <FaCode /> HTML
                </button>
                <button
                  onClick={() => setDetalheModal(null)}
                  className="ml-2 p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 rounded-full transition"
                >
                  <FaTimes size={20} />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto space-y-6">
              
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-2 bg-white p-4 rounded-xl border">
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Motorista</p>
                  <p className="text-lg font-black text-slate-800 uppercase mt-1">{detalheModal.motorista_nome || detalheModal.nome}</p>
                  <p className="text-sm text-slate-400 font-mono mt-1">{detalheModal.motorista_chapa || detalheModal.chapa}</p>
                </div>
                <div className="bg-white p-4 rounded-xl border flex flex-col justify-center">
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Janela</p>
                  <p className="text-lg font-black text-slate-800 mt-1">{detalheModal.janela_aplicada || 0} dias</p>
                </div>
                <div className="bg-white p-4 rounded-xl border flex flex-col gap-2">
                  <div>
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Início Monitoramento</p>
                    <p className="text-sm font-black text-slate-800 mt-0.5">{fmtDateBr(detalheModal.data_ref)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Evento</p>
                    <p className="text-sm font-black text-slate-800 mt-0.5">{detalheModal.checkpoint_tipo}</p>
                  </div>
                </div>
              </div>

              <div className="bg-indigo-50/50 p-5 rounded-xl border border-indigo-100">
                <h3 className="font-black text-indigo-900 uppercase tracking-wide text-sm">Decisão da Etapa</h3>
                <p className="text-indigo-700 text-sm mt-1 mb-4">
                  Escolha abaixo se o caso deve ser encerrado como OK ou encaminhado para tratativa. Ambas as ações irão registrar histórico do checkpoint.
                </p>
                <div className="flex gap-3">
                  <button className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-lg font-black hover:bg-emerald-500 transition shadow-sm">
                    <FaCheckCircle /> Finalizar
                  </button>
                  <button className="flex items-center gap-2 bg-rose-600 text-white px-5 py-2.5 rounded-lg font-black hover:bg-rose-500 transition shadow-sm">
                    <FaArrowRight /> Enviar para Tratativa
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-xl border text-center shadow-sm">
                  <p className="text-sm text-slate-500 font-bold">KM/L Antes</p>
                  <p className="text-3xl font-black text-slate-800 mt-2">{fmtNum(detalheModal.antes_kml)}</p>
                </div>
                <div className="bg-white p-5 rounded-xl border text-center shadow-sm">
                  <p className="text-sm text-slate-500 font-bold">KM/L Depois</p>
                  <p className="text-3xl font-black text-slate-800 mt-2">{fmtNum(detalheModal.depois_kml)}</p>
                </div>
                <div className="bg-white p-5 rounded-xl border text-center shadow-sm flex flex-col items-center justify-center">
                  <p className="text-sm text-slate-500 font-bold mb-2">Delta KM/L</p>
                  <div className="text-2xl">
                    <EvolucaoBadge value={detalheModal.delta_kml} />
                  </div>
                </div>
                <div className="bg-white p-5 rounded-xl border text-center shadow-sm flex flex-col items-center justify-center">
                  <p className="text-sm text-slate-500 font-bold mb-2">Delta Desperdício</p>
                  <div className="text-2xl">
                    <EvolucaoBadge value={detalheModal.delta_desperdicio} invert />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 text-slate-500 font-black text-xs uppercase tracking-wider border-b">
                    <tr>
                      <th className="px-6 py-4">Período</th>
                      <th className="px-6 py-4">KM</th>
                      <th className="px-6 py-4">Litros</th>
                      <th className="px-6 py-4">KM/L Real</th>
                      <th className="px-6 py-4">KM/L Meta</th>
                      <th className="px-6 py-4 text-right">Desperdício</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    <tr>
                      <td className="px-6 py-5 font-black text-slate-800">Antes</td>
                      <td className="px-6 py-5 text-slate-600">{fmtInt(detalheModal.km_antes)}</td>
                      <td className="px-6 py-5 text-slate-600">{fmtInt(detalheModal.litros_antes)}</td>
                      <td className="px-6 py-5 font-black text-slate-800">{fmtNum(detalheModal.antes_kml)}</td>
                      <td className="px-6 py-5 text-slate-500">{fmtNum(detalheModal.meta_kml_antes)}</td>
                      <td className="px-6 py-5 font-black text-slate-800 text-right">{fmtNum(detalheModal.desp_real_antes)} L</td>
                    </tr>
                    <tr>
                      <td className="px-6 py-5 font-black text-slate-800">Depois</td>
                      <td className="px-6 py-5 text-slate-600">{fmtInt(detalheModal.km_depois)}</td>
                      <td className="px-6 py-5 text-slate-600">{fmtInt(detalheModal.litros_depois)}</td>
                      <td className="px-6 py-5 font-black text-slate-800">{fmtNum(detalheModal.depois_kml)}</td>
                      <td className="px-6 py-5 text-slate-500">{fmtNum(detalheModal.meta_kml_depois)}</td>
                      <td className="px-6 py-5 font-black text-slate-800 text-right">{fmtNum(detalheModal.desp_real_depois)} L</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* SEÇÃO DINÂMICA: MEMÓRIA DE CÁLCULO */}
              <div className="bg-blue-50 p-6 rounded-xl border border-blue-200 space-y-4">
                <h3 className="font-black text-blue-900 text-sm uppercase tracking-wider flex items-center gap-2 mb-4">
                  <FaInfoCircle className="text-blue-500" size={18} /> Memória de Cálculo
                </h3>
                
                <p className="text-sm text-blue-800">
                  <strong>1. Ponto de Partida (D0):</strong> O acompanhamento deste motorista iniciou no dia <strong>{fmtDateBr(detalheModal.data_ref)}</strong>.
                </p>
                
                <p className="text-sm text-blue-800">
                  <strong>2. Janela Simétrica:</strong> O algoritmo localizou <strong>{detalheModal.janela_aplicada} dias trabalhados</strong> válidos antes da data de início, e {detalheModal.janela_aplicada} dias trabalhados a partir dela (ignorando folgas).
                </p>
                
                <p className="text-sm text-blue-800">
                  <strong>3. Desempenho Bruto:</strong> No período "Antes", rodou {fmtInt(detalheModal.km_antes)}km consumindo {fmtInt(detalheModal.litros_antes)}L (média de <strong>{fmtNum(detalheModal.antes_kml)} km/l</strong>). 
                  No "Depois", rodou {fmtInt(detalheModal.km_depois)}km consumindo {fmtInt(detalheModal.litros_depois)}L (média de <strong>{fmtNum(detalheModal.depois_kml)} km/l</strong>). 
                  O KM/L sofreu uma variação de <strong>{fmtNum(detalheModal.delta_kml)}</strong>.
                </p>

                <p className="text-sm text-blue-800">
                  <strong>4. Desperdício Ajustado:</strong> Para anular a diferença de quilometragem entre os períodos, projetamos o consumo real: 
                  Se ele dirigisse os mesmos {fmtInt(detalheModal.km_antes)}km do passado com a habilidade atual ({fmtNum(detalheModal.depois_kml)} km/l), ele teria utilizado <strong>{fmtNum(detalheModal.km_antes / (n(detalheModal.depois_kml) || 1))} Litros</strong>. 
                  Subtraindo a meta de combustível da época, o novo desperdício projetado cai para <strong>{fmtNum(detalheModal.desp_ajustado_depois)} Litros</strong>.
                </p>

                <p className="text-sm text-blue-800">
                  <strong>5. Veredito Final:</strong> O desperdício ajustado ({fmtNum(detalheModal.desp_ajustado_depois)} L) comparado ao desperdício real que ele cometeu no passado ({fmtNum(detalheModal.desp_real_antes)} L) gerou um delta de <strong>{fmtNum(detalheModal.delta_desperdicio)} L</strong>. 
                  Avaliando a variação matemática, o sistema classificou a evolução como <span className="font-black bg-blue-200 px-2 py-0.5 rounded text-blue-900">{detalheModal.conclusao_checkpoint || detalheModal.conclusao}</span>.
                </p>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
