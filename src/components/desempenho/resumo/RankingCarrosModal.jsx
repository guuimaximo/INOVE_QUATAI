import React from "react";

export default function RankingCarrosModal({
  veiculosOrdenados,
  sortConfig,
  handleSort,
  fmtNum,
  SortIcon,
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border overflow-x-auto">
      <table className="w-full text-left min-w-[1450px]">
        <thead className="bg-slate-50 text-slate-600 font-extrabold border-b text-xs md:text-sm uppercase tracking-wider select-none">
          <tr>
            {[
              ["veiculo", "Carro"],
              ["linha", "Linha"],
              ["Cluster", "Cluster"],
              ["KML_Real", "KM/L Real"],
              ["KML_Meta", "KM/L Ref"],
              ["Meta_Linha", "Meta Linha"],
              ["Litros_Desperdicio", "Desp. Ref"],
              ["Litros_Desp_Meta", "Desp. Meta"],
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
          {veiculosOrdenados.map((row) => (
            <tr key={row.id} className="hover:bg-blue-50/50 transition-colors">
              <td className="px-4 py-4 font-black text-slate-900">{row.veiculo}</td>
              <td className="px-4 py-4">{row.linha}</td>
              <td className="px-4 py-4">{row.Cluster}</td>
              <td className="px-4 py-4">{fmtNum(row.KML_Real)}</td>
              <td className="px-4 py-4">{fmtNum(row.KML_Meta)}</td>
              <td className="px-4 py-4">{fmtNum(row.Meta_Linha)}</td>
              <td className="px-4 py-4 font-bold text-amber-700">
                {fmtNum(row.Litros_Desperdicio)} L
              </td>
              <td className="px-4 py-4 font-bold text-rose-700">
                {fmtNum(row.Litros_Desp_Meta)} L
              </td>
              <td className="px-4 py-4">{fmtNum(row.Km, 0)}</td>
              <td className="px-4 py-4">{fmtNum(row.Comb)} L</td>
            </tr>
          ))}

          {veiculosOrdenados.length === 0 && (
            <tr>
              <td colSpan={10} className="px-6 py-12 text-center text-slate-500 font-bold">
                Nenhum carro encontrado.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
