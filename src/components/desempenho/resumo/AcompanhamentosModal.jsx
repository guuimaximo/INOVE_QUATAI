import React from "react";

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
  return (
    <>
      <div className="bg-white rounded-xl shadow-sm border p-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h2 className="text-lg md:text-xl font-black text-slate-800">
              {headerSubAcompanhamento[subAcompanhamento]?.titulo || "Acompanhamentos"}
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              {headerSubAcompanhamento[subAcompanhamento]?.subtitulo || ""}
            </p>
          </div>

          <div className="flex flex-wrap bg-slate-100 p-1 rounded-lg gap-1">
            {[
              ["RESUMO_INSTRUTOR", "Resumo por Instrutor"],
              ["TEMPO_DIA", "Tempo por Dia"],
              ["CHECKPOINT_LINHA", "Check Point por Linha"],
              ["ACOMPANHAMENTOS", "Acompanhamentos"],
            ].map(([key, label]) => (
              <button
                key={key}
                onClick={() => setSubAcompanhamento(key)}
                className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${
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
          <p className="text-2xl font-black text-slate-800">{fmtInt(checkpointResumo.total)}</p>
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
            <thead className="bg-white text-slate-600 font-extrabold border-b text-xs md:text-sm uppercase tracking-wider">
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
            <thead className="bg-white text-slate-600 font-extrabold border-b text-xs md:text-sm uppercase tracking-wider">
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
          <table className="w-full text-left min-w-[1200px]">
            <thead className="bg-white text-slate-600 font-extrabold border-b text-xs md:text-sm uppercase tracking-wider">
              <tr>
                <th className="px-4 py-4">Linha</th>
                <th className="px-4 py-4">Prontuário</th>
                <th className="px-4 py-4">Qtd.</th>
                <th className="px-4 py-4">Antes KM/L</th>
                <th className="px-4 py-4">Depois KM/L</th>
                <th className="px-4 py-4">Δ KM/L</th>
                <th className="px-4 py-4">Δ Desp.</th>
                <th className="px-4 py-4">Melhorou</th>
                <th className="px-4 py-4">Piorou</th>
                <th className="px-4 py-4">Sem Evolução</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {resumoPorLinhaCheckpoint.map((row) => (
                <tr key={row.id} className="hover:bg-blue-50/50 transition-colors">
                  <td className="px-4 py-4 font-black text-slate-900">{row.linha_foco}</td>
                  <td className="px-4 py-4">{row.tipo}</td>
                  <td className="px-4 py-4">{fmtInt(row.qtd_motoristas)}</td>
                  <td className="px-4 py-4">{fmtNum(row.antes_kml)}</td>
                  <td className="px-4 py-4">{fmtNum(row.depois_kml)}</td>
                  <td className="px-4 py-4">
                    <EvolucaoBadge value={row.delta_kml} />
                  </td>
                  <td className="px-4 py-4">
                    <EvolucaoBadge value={row.delta_desperdicio} invert />
                  </td>
                  <td className="px-4 py-4">{fmtInt(row.melhorou)}</td>
                  <td className="px-4 py-4">{fmtInt(row.piorou)}</td>
                  <td className="px-4 py-4">{fmtInt(row.sem_evolucao)}</td>
                </tr>
              ))}
              {resumoPorLinhaCheckpoint.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-6 py-12 text-center text-slate-500 font-bold">
                    Nenhum checkpoint encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {subAcompanhamento === "ACOMPANHAMENTOS" && (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <table className="w-full table-fixed text-left">
            <thead className="bg-white text-slate-600 font-extrabold border-b text-[11px] md:text-xs uppercase tracking-wider">
              <tr>
                <th className="px-3 py-3 w-[8%]">Data</th>
                <th className="px-3 py-3 w-[16%]">Motorista</th>
                <th className="px-3 py-3 w-[8%]">Linha</th>
                <th className="px-3 py-3 w-[12%]">Instrutor</th>
                <th className="px-3 py-3 w-[10%]">Status</th>
                <th className="px-3 py-3 w-[8%]">Prontuário</th>
                <th className="px-3 py-3 w-[7%]">Antes KM/L</th>
                <th className="px-3 py-3 w-[7%]">Depois KM/L</th>
                <th className="px-3 py-3 w-[7%]">Δ KM/L</th>
                <th className="px-3 py-3 w-[7%]">Antes Desp.</th>
                <th className="px-3 py-3 w-[7%]">Desp. Ajust.</th>
                <th className="px-3 py-3 w-[11%]">Conclusão</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {acompanhamentosComEvolucao.map((row) => (
                <tr key={row.id} className="hover:bg-blue-50/50 transition-colors align-top">
                  <td className="px-3 py-3 text-xs md:text-sm whitespace-normal break-words">
                    {fmtDateBr(row.data_ref)}
                  </td>

                  <td className="px-3 py-3 text-xs md:text-sm whitespace-normal break-words">
                    <div className="font-black text-slate-900">{row.motorista_nome || "-"}</div>
                    <div className="text-xs text-slate-600 font-mono bg-slate-100 px-2 py-0.5 rounded w-fit mt-1 border border-slate-200">
                      {row.motorista_chapa || "-"}
                    </div>
                  </td>

                  <td className="px-3 py-3 text-xs md:text-sm whitespace-normal break-words">
                    {row.linha_resolvida}
                  </td>

                  <td className="px-3 py-3 text-xs md:text-sm whitespace-normal break-words">
                    {row.instrutor_nome || "-"}
                  </td>

                  <td className="px-3 py-3 text-xs md:text-sm whitespace-normal break-words">
                    <span
                      className={`px-2 py-1 rounded-lg text-[11px] font-bold border inline-flex items-center gap-1.5 whitespace-normal ${statusBadgeClass(
                        row.status_norm
                      )}`}
                    >
                      {row.status_norm}
                    </span>
                  </td>

                  <td className="px-3 py-3 text-xs md:text-sm whitespace-normal break-words">
                    {row.prontuario_label || row.checkpoint_tipo || "-"}
                  </td>

                  <td className="px-3 py-3 text-xs md:text-sm whitespace-normal break-words">
                    {row.antes_kml == null ? "-" : fmtNum(row.antes_kml)}
                  </td>

                  <td className="px-3 py-3 text-xs md:text-sm whitespace-normal break-words">
                    {row.depois_kml == null ? "-" : fmtNum(row.depois_kml)}
                  </td>

                  <td className="px-3 py-3 text-xs md:text-sm whitespace-normal break-words">
                    {row.delta_kml == null ? "-" : <EvolucaoBadge value={row.delta_kml} />}
                  </td>

                  <td className="px-3 py-3 text-xs md:text-sm whitespace-normal break-words">
                    {row.antes_desp == null ? "-" : `${fmtNum(row.antes_desp)} L`}
                  </td>

                  <td className="px-3 py-3 text-xs md:text-sm whitespace-normal break-words">
                    {row.depois_desp == null ? (
                      "-"
                    ) : row.antes_desp == null ? (
                      `${fmtNum(row.depois_desp)} L`
                    ) : row.depois_desp < row.antes_desp ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold border bg-emerald-50 text-emerald-700 border-emerald-200">
                        {fmtNum(row.depois_desp)} L
                      </span>
                    ) : row.depois_desp > row.antes_desp ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold border bg-rose-50 text-rose-700 border-rose-200">
                        {fmtNum(row.depois_desp)} L
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold border bg-slate-50 text-slate-700 border-slate-200">
                        {fmtNum(row.depois_desp)} L
                      </span>
                    )}
                  </td>

                  <td className="px-3 py-3 text-xs md:text-sm whitespace-normal break-words">
                    {row.conclusao_checkpoint || "-"}
                  </td>
                </tr>
              ))}

              {acompanhamentosComEvolucao.length === 0 && (
                <tr>
                  <td colSpan={12} className="px-6 py-12 text-center text-slate-500 font-bold">
                    Nenhum acompanhamento encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
