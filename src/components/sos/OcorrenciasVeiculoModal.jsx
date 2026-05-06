// src/components/sos/OcorrenciasVeiculoModal.jsx

import { FaTimes, FaBus, FaTools, FaWrench } from "react-icons/fa";

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

function s(v) {
  return String(v || "").trim();
}

function n(v) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function fmtDias(v) {
  const dias = n(v);
  if (!dias) return "—";
  return `${dias} dia${dias === 1 ? "" : "s"}`;
}

const CORES_OCORRENCIA = {
  SOS: "bg-rose-100 text-rose-700 border-rose-200",
  RECOLHEU: "bg-blue-100 text-blue-700 border-blue-200",
  TROCA: "bg-amber-100 text-amber-800 border-amber-200",
  AVARIA: "bg-slate-200 text-slate-800 border-slate-300",
  IMPROCEDENTE: "bg-purple-100 text-purple-700 border-purple-200",
  "SEGUIU VIAGEM": "bg-emerald-100 text-emerald-700 border-emerald-200",
};

function OcorrenciaBadge({ value }) {
  const tipo = s(value).toUpperCase() || "—";
  const cls = CORES_OCORRENCIA[tipo] || "bg-slate-100 text-slate-700 border-slate-200";

  return (
    <span
      className={`inline-flex px-2.5 py-1 rounded-lg border text-[10px] font-black uppercase tracking-wider ${cls}`}
    >
      {tipo}
    </span>
  );
}

function hasInfoPreventiva(item) {
  return (
    s(item?.os_ultima_preventiva) ||
    s(item?.os_ultima_inspecao) ||
    n(item?.dias_ultima_preventiva_calc) > 0 ||
    n(item?.dias_ultima_inspecao_calc) > 0 ||
    s(item?.tipo_revisao_atribuida) ||
    s(item?.responsavel_revisao)
  );
}

function PreventivaResumo({ item }) {
  if (!hasInfoPreventiva(item)) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
      <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3">
        <div className="flex items-center gap-2 text-emerald-700 font-black uppercase tracking-wider mb-2">
          <FaWrench />
          Última preventiva
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className="text-[10px] font-black text-slate-500 uppercase">OS</p>
            <p className="font-black text-slate-800">
              {item.os_ultima_preventiva || "—"}
            </p>
          </div>

          <div>
            <p className="text-[10px] font-black text-slate-500 uppercase">Dias</p>
            <p className="font-black text-slate-800">
              {fmtDias(item.dias_ultima_preventiva_calc)}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-blue-100 bg-blue-50 p-3">
        <div className="flex items-center gap-2 text-blue-700 font-black uppercase tracking-wider mb-2">
          <FaTools />
          Última inspeção
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className="text-[10px] font-black text-slate-500 uppercase">OS</p>
            <p className="font-black text-slate-800">
              {item.os_ultima_inspecao || "—"}
            </p>
          </div>

          <div>
            <p className="text-[10px] font-black text-slate-500 uppercase">Dias</p>
            <p className="font-black text-slate-800">
              {fmtDias(item.dias_ultima_inspecao_calc)}
            </p>
          </div>
        </div>
      </div>

      {(item.tipo_revisao_atribuida || item.responsavel_revisao) && (
        <div className="md:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <div>
              <p className="text-[10px] font-black text-slate-500 uppercase">
                Revisão atribuída
              </p>
              <p className="font-black text-slate-800">
                {item.tipo_revisao_atribuida || "—"}
              </p>
            </div>

            <div className="md:col-span-2">
              <p className="text-[10px] font-black text-slate-500 uppercase">
                Responsável técnico
              </p>
              <p className="font-black text-slate-800">
                {item.responsavel_revisao || "—"}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function OcorrenciasVeiculoModal({
  titulo,
  subtitulo,
  veiculo,
  valor,
  tipo,
  ocorrencias = [],
  onClose,
}) {
  const tituloFinal =
    titulo ||
    (veiculo
      ? `Ocorrências do veículo ${veiculo}`
      : valor
      ? `Ocorrências - ${valor}`
      : "Ocorrências");

  const lista = [...ocorrencias].sort((a, b) =>
    String(b.data_sos || b.created_at || "").localeCompare(
      String(a.data_sos || a.created_at || "")
    )
  );

  const deveMostrarPreventiva = lista.some(hasInfoPreventiva);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center">
              <FaBus />
            </div>

            <div>
              <h2 className="text-lg font-black text-slate-800">
                {tituloFinal}
              </h2>

              <p className="text-xs text-slate-500 font-semibold">
                {subtitulo ||
                  `${lista.length} ocorrência(s) encontrada(s)${
                    tipo ? ` • ${tipo}` : ""
                  }`}
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

                {deveMostrarPreventiva && (
                  <th className="px-4 py-3 text-left text-xs font-black uppercase min-w-[360px]">
                    Preventiva / Inspeção / Técnico
                  </th>
                )}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {lista.length === 0 ? (
                <tr>
                  <td
                    colSpan={deveMostrarPreventiva ? 5 : 4}
                    className="px-4 py-8 text-center text-slate-500 font-semibold"
                  >
                    Nenhuma ocorrência encontrada.
                  </td>
                </tr>
              ) : (
                lista.map((item, idx) => (
                  <tr
                    key={item.id || `${item.veiculo}-${idx}`}
                    className="hover:bg-slate-50 align-top"
                  >
                    <td className="px-4 py-3 font-bold text-slate-800 whitespace-nowrap">
                      {fmtDateBr(item.data_sos || item.created_at)}
                    </td>

                    <td className="px-4 py-3">
                      <OcorrenciaBadge value={item.tipo_norm || item.ocorrencia} />
                    </td>

                    <td className="px-4 py-3 font-semibold text-slate-700 min-w-[180px]">
                      {item.problema_encontrado || "—"}
                    </td>

                    <td className="px-4 py-3 text-slate-600 min-w-[320px] max-w-[460px]">
                      {item.solucao || item.solucao_manutencao || "—"}
                    </td>

                    {deveMostrarPreventiva && (
                      <td className="px-4 py-3 min-w-[420px]">
                        <PreventivaResumo item={item} />
                      </td>
                    )}
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
