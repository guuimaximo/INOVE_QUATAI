import { useEffect } from "react";
import { FaDownload, FaTimes } from "react-icons/fa";

function isImageUrl(url) {
  const value = String(url || "").toLowerCase();
  return /\.(png|jpe?g|gif|webp|bmp|svg)(\?|#|$)/.test(value);
}

function isPdfUrl(url) {
  const value = String(url || "").toLowerCase();
  return value.includes(".pdf") || /\.(pdf)(\?|#|$)/.test(value);
}

export default function FileViewerModal({ open, url, name, onClose }) {
  useEffect(() => {
    if (!open) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose?.();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open || !url) return null;

  const fileName = name || "arquivo";
  const image = isImageUrl(url);
  const pdf = isPdfUrl(url);

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-blue-600">
              Visualizador
            </p>
            <p className="mt-2 truncate text-base font-bold text-slate-900">{fileName}</p>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={url}
              download={fileName}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-700"
            >
              <FaDownload />
              Baixar
            </a>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-200"
            >
              <FaTimes />
              Fechar
            </button>
          </div>
        </div>

        <div className="flex min-h-[320px] flex-1 items-center justify-center bg-slate-100 p-4">
          {image ? (
            <img
              src={url}
              alt={fileName}
              className="max-h-[78vh] w-auto max-w-full rounded-2xl border border-slate-200 bg-white object-contain shadow-sm"
            />
          ) : pdf ? (
            <iframe
              title={fileName}
              src={url}
              className="h-[78vh] w-full rounded-2xl border border-slate-200 bg-white"
            />
          ) : (
            <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
              <p className="text-sm font-semibold text-slate-600">
                Nao foi possivel gerar visualizacao direta para este arquivo.
              </p>
              <p className="mt-2 text-lg font-black text-slate-900">{fileName}</p>
              <a
                href={url}
                download={fileName}
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-700"
              >
                <FaDownload />
                Baixar arquivo
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
