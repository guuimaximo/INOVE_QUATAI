import { FaExternalLinkAlt, FaTimes } from "react-icons/fa";

function isPdfUrl(url = "") {
  return /\.pdf(\?|#|$)/i.test(String(url));
}

function isVideoUrl(url = "") {
  return /\.(mp4|webm|mov|m4v|ogg)(\?|#|$)/i.test(String(url));
}

export default function MediaPreviewModal({
  open,
  url,
  title = "Evidencia",
  onClose,
}) {
  if (!open || !url) return null;

  const isPdf = isPdfUrl(url);
  const isVideo = isVideoUrl(url);

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div className="min-w-0">
            <div className="truncate text-base font-black text-slate-900">{title}</div>
            <div className="truncate text-xs font-semibold text-slate-500">{url}</div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
              title="Abrir em nova aba"
            >
              <FaExternalLinkAlt />
            </a>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
              title="Fechar"
            >
              <FaTimes />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto bg-slate-100 p-4">
          {isPdf ? (
            <iframe
              src={url}
              title={title}
              className="h-[78vh] w-full rounded-xl border border-slate-300 bg-white"
            />
          ) : isVideo ? (
            <video
              src={url}
              controls
              autoPlay
              className="mx-auto max-h-[78vh] max-w-full rounded-xl bg-black shadow"
            />
          ) : (
            <img
              src={url}
              alt={title}
              className="mx-auto max-h-[78vh] max-w-full rounded-xl bg-white object-contain shadow"
            />
          )}
        </div>
      </div>
    </div>
  );
}
