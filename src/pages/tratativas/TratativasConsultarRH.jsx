// src/pages/TratativasConsultarRH.jsx
import React, { useMemo } from "react";

/* =========================
   Helpers
========================= */
function brDateTime(d) {
  if (!d) return "—";
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleString("pt-BR");
}

function brDate(d) {
  if (!d) return "—";
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString("pt-BR");
}

function fileNameFromUrl(u) {
  try {
    const raw = String(u || "");
    const noHash = raw.split("#")[0];
    const noQuery = noHash.split("?")[0];
    const last = noQuery.split("/").filter(Boolean).pop() || "arquivo";
    return decodeURIComponent(last);
  } catch {
    return "arquivo";
  }
}

function isImageUrl(u) {
  const s = String(u || "").toLowerCase();
  return /\.(png|jpe?g|gif|webp|bmp|svg)(\?|#|$)/.test(s);
}

function isPdf(u) {
  const s = String(u || "").toLowerCase();
  return s.includes(".pdf") || /\.(pdf)(\?|#|$)/.test(s);
}

function Thumb({ url }) {
  if (!url) return <span className="text-gray-400">—</span>;
  const img = isImageUrl(url) && !isPdf(url);

  return img ? (
    <a href={url} target="_blank" rel="noopener noreferrer" title="Abrir">
      <img
        src={url}
        alt={fileNameFromUrl(url)}
        className="h-14 w-14 rounded border object-cover hover:opacity-90"
        loading="lazy"
      />
    </a>
  ) : (
    <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline text-xs">
      {fileNameFromUrl(url)}
    </a>
  );
}

export default function TratativasConsultarRH({ aberto, grupo, onClose }) {
  const titulo = "Consultar (RH)";

  const evidenciasTratador = useMemo(() => {
    const arr = Array.from(new Set([...(grupo?.evidencia_conclusao_urls || []), ...(grupo?.anexo_tratador_urls || [])]));
    return arr.filter(Boolean);
  }, [grupo]);

  if (!aberto || !grupo) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="w-full max-w-4xl bg-white rounded-lg shadow-lg overflow-hidden">
        {/* header */}
        <div className="p-4 border-b flex items-center justify-between">
          <div>
            <div className="text-lg font-bold">{titulo}</div>
            <div className="text-xs text-gray-500">
              <span className="font-semibold">{grupo.acao_aplicada}</span> • {grupo.motorista_nome} ({grupo.motorista_chapa})
              {" "}• Arquivo: <span className="font-semibold">{grupo.arquivo_key}</span> • {grupo.qtd_tratativas} tratativa(s)
            </div>
          </div>
          <button onClick={onClose} className="rounded-md bg-gray-200 px-4 py-2 text-sm hover:bg-gray-300">
            Fechar
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* tabela azul com tratativas consolidadas */}
          <div className="bg-white shadow rounded-lg overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-blue-600 text-white">
                <tr>
                  <th className="py-2 px-3 text-left">Data</th>
                  <th className="py-2 px-3 text-left">Ocorrência</th>
                  <th className="py-2 px-3 text-left">Linha</th>
                  <th className="py-2 px-3 text-left">Prioridade</th>
                  <th className="py-2 px-3 text-left">Setor</th>
                  <th className="py-2 px-3 text-left">Data Ocorrido</th>
                </tr>
              </thead>
              <tbody>
                {(grupo.itens || []).map((i) => (
                  <tr key={`${i.tratativa_id}-${i.detalhe_id}`} className="border-t hover:bg-gray-50">
                    <td className="py-2 px-3 text-gray-700">{brDateTime(i.detalhe_created_at)}</td>
                    <td className="py-2 px-3 text-gray-700">{i.tipo_ocorrencia || "—"}</td>
                    <td className="py-2 px-3 text-gray-700">{i.linha || "—"}</td>
                    <td className="py-2 px-3 text-gray-700">{i.prioridade || "—"}</td>
                    <td className="py-2 px-3 text-gray-700">{i.setor_origem || "—"}</td>
                    <td className="py-2 px-3 text-gray-700">{brDate(i.data_ocorrido)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* evidências miniatura */}
          <div>
            <div className="text-sm text-gray-600 mb-2">Evidências (Tratador) — miniaturas</div>
            <div className="flex flex-wrap gap-2">
              {evidenciasTratador.length === 0 ? (
                <div className="text-sm text-gray-400">—</div>
              ) : (
                evidenciasTratador.map((u) => <Thumb key={u} url={u} />)
              )}
            </div>
          </div>

          <hr />

          {/* RH */}
          <div>
            <div className="text-sm font-semibold mb-2">RH (Transnet)</div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-xs text-gray-500">Status RH</div>
                <div className="text-sm font-medium">Concluída</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Lançado em</div>
                <div className="text-sm font-medium">{grupo.rh_lancado_em ? brDateTime(grupo.rh_lancado_em) : "—"}</div>
              </div>
            </div>

            <div className="mt-3">
              <div className="text-sm text-gray-600 mb-1">Observação RH</div>
              <div className="rounded-md border bg-gray-50 p-3 text-sm whitespace-pre-wrap">
                {grupo.rh_obs || "—"}
              </div>
            </div>

            <div className="mt-3">
              <div className="text-sm text-gray-600 mb-2">Evidência RH (Transnet) — miniatura</div>
              {grupo.rh_evid_url ? <Thumb url={grupo.rh_evid_url} /> : <div className="text-sm text-gray-400">—</div>}
            </div>
          </div>
        </div>

        <div className="p-4 border-t flex items-center justify-end">
          <button onClick={onClose} className="rounded-md bg-gray-200 px-4 py-2 text-sm hover:bg-gray-300">
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
