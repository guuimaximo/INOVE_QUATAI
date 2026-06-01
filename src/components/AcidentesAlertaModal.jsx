import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FaCamera, FaExclamationTriangle, FaTimes } from "react-icons/fa";
import { useAcidentesPendentes } from "../hooks/useAcidentesPendentes";

// Aparece UMA vez por sessao quando o usuario elegivel entra no Inove
// e ja existem acidentes "Aguardando imagens" na base.
export default function AcidentesAlertaModal() {
  const { elegivel, count, rows } = useAcidentesPendentes();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [vistoNestaSessao, setVistoNestaSessao] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem("acidentes-alerta-visto") === "1") {
        setVistoNestaSessao(true);
      }
    } catch {
      /* ignora */
    }
  }, []);

  useEffect(() => {
    if (!elegivel) return;
    if (vistoNestaSessao) return;
    if (count > 0) setOpen(true);
  }, [elegivel, count, vistoNestaSessao]);

  function fechar() {
    setOpen(false);
    setVistoNestaSessao(true);
    try {
      sessionStorage.setItem("acidentes-alerta-visto", "1");
    } catch {
      /* ignora */
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-amber-200 bg-amber-50 px-5 py-4">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-amber-200 text-amber-800">
              <FaCamera />
            </span>
            <div>
              <h3 className="text-base font-black text-amber-900">
                Solicitações de imagens pendentes
              </h3>
              <p className="mt-1 text-sm font-semibold text-amber-800">
                Há <strong>{count}</strong> acidente{count > 1 ? "s" : ""} aguardando o envio das imagens.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={fechar}
            className="rounded-lg p-1.5 text-amber-700 transition hover:bg-amber-100"
            title="Fechar"
          >
            <FaTimes />
          </button>
        </div>

        <div className="max-h-[40vh] overflow-y-auto p-5">
          {rows.length === 0 ? (
            <p className="text-sm font-semibold text-slate-500">Sem detalhes adicionais.</p>
          ) : (
            <ul className="space-y-2">
              {rows.slice(0, 8).map((row) => (
                <li
                  key={row.id}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                >
                  <div className="flex items-center justify-between gap-2 font-bold text-slate-800">
                    <span>#{row.numero_ocorrencia || row.id}</span>
                    <span className="text-xs font-semibold text-slate-500">
                      {row.data_ocorrencia ? new Date(`${row.data_ocorrencia}T00:00:00`).toLocaleDateString("pt-BR") : "-"}
                    </span>
                  </div>
                  <div className="mt-0.5 text-xs font-semibold text-slate-600">
                    {row.prefixo || "Sem prefixo"} · {row.linha || "Sem linha"}
                  </div>
                  {row.motorista_nome ? (
                    <div className="text-[11px] text-slate-500">{row.motorista_nome}</div>
                  ) : null}
                </li>
              ))}
              {rows.length > 8 ? (
                <li className="text-center text-xs font-semibold text-slate-500">
                  +{rows.length - 8} adicional(is)
                </li>
              ) : null}
            </ul>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50 px-5 py-3">
          <span className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500">
            <FaExclamationTriangle className="text-amber-500" /> Atualize as imagens o quanto antes.
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={fechar}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-100"
            >
              Lembrar depois
            </button>
            <Link
              to="/acidentes/imagens"
              onClick={() => {
                fechar();
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-amber-700"
            >
              <FaCamera /> Ir para Imagens
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
