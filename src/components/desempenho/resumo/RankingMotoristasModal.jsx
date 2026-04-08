import React from "react";

export default function RankingMotoristasModal({
  motoristasOrdenados,
  sortConfig,
  handleSort,
  fmtNum,
  SortIcon,
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border overflow-x-auto">
      <table className="w-full text-left min-w-[1500px]">
        <thead className="bg-slate-50 text-slate-600 font-extrabold border-b text-xs md:text-sm uppercase tracking-wider select-none">
          <tr>
            {[
              ["Motorista", "Motorista"],
              ["chapa", "Chapa"],
              ["linha", "Linha"],
              ["Cluster", "Cluster"],
              ["KML_Real", "KM/L Real"],
              ["KML_Meta", "KM/L Meta"],
              ["Litros_Desp_Meta", "Desperdício"],
              ["Impacto_Pct", "Impacto %"],
              ["Km", "KM"],
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
          {motoristasOrdenados.map((row) => (
            <tr key={row.id} className="hover:bg-blue-50/50 transition-colors">
              <td className="px-4 py-4">
                <div className="font-black text-slate-900">{row.Motorista}</div>
              </td>

              <td className="px-4 py-4">
                <span className="text-xs text-slate-600 font-mono bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                  {row.chapa}
                </span>
              </td>

              <td className="px-4 py-4">{row.linha}</td>
              <td className="px-4 py-4">{row.Cluster}</td>
              <td className="px-4 py-4">{fmtNum(row.KML_Real)}</td>
              <td className="px-4 py-4">{fmtNum(row.KML_Meta)}</td>

              <td className="px-4 py-4 font-bold text-rose-700">
                {fmtNum(row.Litros_Desp_Meta)} L
              </td>

              <td className="px-4 py-4">{fmtNum(row.Impacto_Pct)}%</td>
              <td className="px-4 py-4">{fmtNum(row.Km, 0)}</td>
            </tr>
          ))}

          {motoristasOrdenados.length === 0 && (
            <tr>
              <td colSpan={9} className="px-6 py-12 text-center text-slate-500 font-bold">
                Nenhum motorista encontrado.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
