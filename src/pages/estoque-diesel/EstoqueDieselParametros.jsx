import {
  FaChartLine,
  FaRulerCombined,
  FaSlidersH,
  FaWarehouse,
} from "react-icons/fa";
import EstoqueDieselPageShell, {
  EstoqueDieselPanel,
} from "../../components/estoque-diesel/EstoqueDieselPageShell";

const reguaPreview = [
  ["1,0 cm", "13 L"],
  ["5,0 cm", "145 L"],
  ["10,0 cm", "408 L"],
  ["15,0 cm", "745 L"],
  ["20,0 cm", "1.127 L"],
];

const tolerancias = [
  ["5.000 L", "0,0105%", "4,947 L"],
  ["10.000 L", "0,0105%", "9,895 L"],
  ["15.000 L", "0,0105%", "14,842 L"],
  ["20.000 L", "0,0105%", "19,790 L"],
  ["25.000 L", "0,0105%", "24,737 L"],
  ["30.000 L", "0,0105%", "29,685 L"],
  ["35.000 L", "0,0105%", "34,632 L"],
];

export default function EstoqueDieselParametros() {
  return (
    <EstoqueDieselPageShell
      title="Parametros"
      description="Governanca do modulo com geometria do tanque, curva regua-litros, regras de estoque e tolerancias de recebimento."
    >
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <EstoqueDieselPanel className="p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700">
              <FaWarehouse />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-800">Parametros do tanque</h2>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                Origem direta na aba "Parametros tanque".
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            {[
              "Codigo do tanque",
              "Produto",
              "Diametro (m)",
              "Raio (m)",
              "Comprimento (m)",
              "Capacidade operacional",
            ].map((item) => (
              <div
                key={item}
                className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600"
              >
                {item}
              </div>
            ))}
          </div>
        </EstoqueDieselPanel>

        <EstoqueDieselPanel className="p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700">
              <FaRulerCombined />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-800">Curva regua-litros</h2>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                A conversao da regua para litros deve seguir a curva oficial armazenada por tanque.
              </p>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-black uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="rounded-l-2xl px-4 py-3">Regua</th>
                  <th className="rounded-r-2xl px-4 py-3">Litros</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reguaPreview.map((row) => (
                  <tr key={row[0]}>
                    <td className="px-4 py-3 font-semibold text-slate-600">{row[0]}</td>
                    <td className="px-4 py-3 font-semibold text-slate-600">{row[1]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </EstoqueDieselPanel>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <EstoqueDieselPanel className="p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700">
              <FaChartLine />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-800">Regras de estoque</h2>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                Base da aba "Regras de Estoque" para minimo, medio e maximo.
              </p>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-black uppercase tracking-wider text-slate-500">
                <tr>
                  {["Regra", "S500", "S10", "Total"].map((header, index) => (
                    <th
                      key={header}
                      className={`px-4 py-3 ${index === 0 ? "rounded-l-2xl" : ""} ${
                        index === 3 ? "rounded-r-2xl" : ""
                      }`}
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[
                  ["Estoque minimo", "14.000", "10.000", "24.000"],
                  ["Estoque medio", "30.000", "15.000", "45.000"],
                  ["Estoque maximo", "47.000", "10.000", "57.000"],
                ].map((row) => (
                  <tr key={row[0]}>
                    {row.map((cell, index) => (
                      <td
                        key={`${row[0]}-${index}`}
                        className={`px-4 py-3 ${
                          index === 0 ? "font-black text-slate-800" : "font-semibold text-slate-600"
                        }`}
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </EstoqueDieselPanel>

        <EstoqueDieselPanel className="p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700">
              <FaSlidersH />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-800">Tolerancias operacionais</h2>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                A aba "Variacao aceitavel Diesel" deve ser parametro oficial do recebimento.
              </p>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-black uppercase tracking-wider text-slate-500">
                <tr>
                  {["Volume NF", "% variacao", "Dif. aceitavel"].map((header, index) => (
                    <th
                      key={header}
                      className={`px-4 py-3 ${index === 0 ? "rounded-l-2xl" : ""} ${
                        index === 2 ? "rounded-r-2xl" : ""
                      }`}
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tolerancias.map((row) => (
                  <tr key={row[0]}>
                    {row.map((cell) => (
                      <td key={`${row[0]}-${cell}`} className="px-4 py-3 font-semibold text-slate-600">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-slate-700">
            Se o volume descarregado for menor do que a diferenca aceitavel, o modulo deve bloquear o recebimento e abrir tratativa para suprimentos.
          </div>
        </EstoqueDieselPanel>
      </div>
    </EstoqueDieselPageShell>
  );
}
