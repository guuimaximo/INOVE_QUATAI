// src/components/sos/OcorrenciasVeiculoModal.jsx

import { FaTimes, FaBus } from "react-icons/fa";

function safeDateStr(v) {
  if (!v) return "";
  const txt = String(v || "").trim();
  if (!txt) return "";
  if (txt.includes("T")) return txt.split("T")[0];
  if (txt.includes(" ")) return txt.split(" ")[0];

  const br = txt.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) {
    const [, dd, mm, yyyy] = br;
    return `${yyyy}-${mm}-${dd}`;
  }

  return txt;
}

function fmtDateBr(v) {
  const dt = safeDateStr(v);
  if (!dt) return "-";
  const p = dt.split("-");
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : dt;
}

export default function OcorrenciasVeiculoModal({
  veiculo,
  ocorrencias = [],
  onClose,
}) {
  const lista = [...ocorrencias].sort((a, b) =>
    String(b.data_sos || b.created_at || "").localeCompare(
      String(a.data_sos || a.created_at || "")
    )
  );

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center">
              <FaBus />
            </div>

            <div>
              <h2 className="text-lg font-black text-slate-800">
                Ocorrências do veículo {veiculo}
              </h2>
              <p className="text-xs text-slate-500 font-semibold">
                {lista.length} ocorrência(s) encontrada(s)
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
          >
            <FaTimes />
          </button>
        </div>

        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 text-slate-600 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-black uppercase">
                  Data
                </th>
                <th className="px-4 py-3 text-left text-xs font-black uppercase">
                  Ocorrência
                </th>
                <th className="px-4 py-3 text-left text-xs font-black uppercase">
                  Defeito
                </th>
                <th className="px-4 py-3 text-left text-xs font-black uppercase">
                  Solução
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {lista.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-8 text-center text-slate-500 font-semibold"
                  >
                    Nenhuma ocorrência encontrada para este veículo.
                  </td>
                </tr>
              ) : (
                lista.map((item, idx) => (
                  <tr key={item.id || `${item.veiculo}-${idx}`} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-bold text-slate-800 whitespace-nowrap">
                      {fmtDateBr(item.data_sos || item.created_at)}
                    </td>

                    <td className="px-4 py-3">
                      <span className="inline-flex px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-[11px] font-black uppercase">
                        {item.tipo_norm || item.ocorrencia || "—"}
                      </span>
                    </td>

                    <td className="px-4 py-3 font-semibold text-slate-700">
                      {item.problema_encontrado || "—"}
                    </td>

                    <td className="px-4 py-3 text-slate-600 max-w-[420px]">
                      {item.solucao || item.solucao_manutencao || "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="px-5 py-3 border-t bg-white flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-800 text-white font-bold hover:bg-slate-700 transition"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
