import React from "react";

export default function AnaliseLinhasModal({
  kmlReferenciaGeral,
  kmlComparacaoGeral,
  variacaoGeral,
  totalDesperdicioMeta,
  linhasTabelaOrdenada,
  sortConfig,
  handleSort,
  fmtNum,
  fmtInt,
  EvolucaoBadge,
  SortIcon,
}) {
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border shadow-sm">
          <p className="text-sm text-gray-500 font-bold">KM/L Mês Referência</p>
          <p className="text-2xl font-black text-slate-800">{fmtNum(kmlReferenciaGeral)}</p>
        </div>

        <div className="bg-white p-4 rounded-xl border shadow-sm">
          <p className="text-sm text-gray-500 font-bold">KM/L Mês Comparação</p>
          <p className="text-2xl font-black text-slate-800">{fmtNum(kmlComparacaoGeral)}</p>
        </div>

        <div className="bg-white p-4 rounded-xl border shadow-sm">
          <p className="text-sm text-gray-500 font-bold">Variação vs comparação</p>
          <p className="text-2xl font-black text-slate-800">{fmtNum(variacaoGeral)}%</p>
        </div>

        <div className="bg-white p-4 rounded-xl border shadow-sm">
          <p className="text-sm text-gray-500 font-bold">Desperdício Meta</p>
          <p className="text-2xl font-black text-slate-800">{fmtNum(totalDesperdicioMeta)} L</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-x-auto">
        <table className="w-full text-left min-w-[1100px]">
          <thead className="bg-slate-50 text-slate-600 font-extrabold border-b text-xs md:text-sm uppercase tracking-wider select-none">
            <tr>
              {[
                ["linha", "Linha"],
                ["KML_Anterior", "KM/L Comp."],
                ["KML_Atual", "KM/L Ref."],
                ["Variacao_Pct", "Var.%"],
                ["Meta_Ponderada", "Meta"],
                ["Desperdicio", "Desperdício"],
                ["Km", "KM"],
                ["Comb", "Comb."],
              ].map(([key, label]) => (
                <th
                  key={key}
                  className="px-4 py-4 cursor-pointer hover:bg-slate-100 transition-colors"
                  onClick={() => handleSort(key)}
                >
                  <div className="flex items-center">
                    {label}
                    <SortIcon
                      active={sortConfig.key === key}
                      direction={sortConfig.direction}
                    />
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100">
            {linhasTabelaOrdenada.map((row) => (
              <tr key={row.id} className="hover:bg-blue-50/50 transition-colors">
                <td className="px-4 py-4 font-black text-slate-900">{row.linha}</td>
                <td className="px-4 py-4">{fmtNum(row.KML_Anterior)}</td>
                <td className="px-4 py-4">{fmtNum(row.KML_Atual)}</td>
                <td className="px-4 py-4">
                  <EvolucaoBadge value={row.Variacao_Pct} percent />
                </td>
                <td className="px-4 py-4">{fmtNum(row.Meta_Ponderada)}</td>
                <td className="px-4 py-4 font-bold text-rose-700">
                  {fmtNum(row.Desperdicio)} L
                </td>
                <td className="px-4 py-4">{fmtInt(row.Km)}</td>
                <td className="px-4 py-4">{fmtNum(row.Comb)} L</td>
              </tr>
            ))}

            {linhasTabelaOrdenada.length === 0 && (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center text-slate-500 font-bold">
                  Nenhuma linha encontrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
