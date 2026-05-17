import { useMemo, useState } from "react";
import {
  FaBoxOpen,
  FaDownload,
  FaPaperclip,
  FaPlus,
  FaTimes,
} from "react-icons/fa";
import FileViewerModal from "../../components/FileViewerModal";
import { fileNameFromUrl } from "./suprimentosShared";

const TONE_MAP = {
  slate: {
    chip: "border-slate-200 bg-slate-100 text-slate-700",
    card: "from-slate-50 to-white border-slate-200",
  },
  blue: {
    chip: "border-blue-200 bg-blue-50 text-blue-700",
    card: "from-blue-50 to-cyan-50 border-blue-200",
  },
  cyan: {
    chip: "border-cyan-200 bg-cyan-50 text-cyan-700",
    card: "from-cyan-50 to-sky-50 border-cyan-200",
  },
  amber: {
    chip: "border-amber-200 bg-amber-50 text-amber-700",
    card: "from-amber-50 to-orange-50 border-amber-200",
  },
  emerald: {
    chip: "border-emerald-200 bg-emerald-50 text-emerald-700",
    card: "from-emerald-50 to-teal-50 border-emerald-200",
  },
  rose: {
    chip: "border-rose-200 bg-rose-50 text-rose-700",
    card: "from-rose-50 to-pink-50 border-rose-200",
  },
  violet: {
    chip: "border-violet-200 bg-violet-50 text-violet-700",
    card: "from-violet-50 to-fuchsia-50 border-violet-200",
  },
};

export function PageHero({ eyebrow, title, description, actions = null }) {
  return (
    <section className="rounded-[28px] border border-slate-200 bg-white px-6 py-6 shadow-sm">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <p className="text-xs font-black uppercase tracking-[0.35em] text-blue-600">{eyebrow}</p>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-900">{title}</h1>
          <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-slate-600">{description}</p>
        </div>

        {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
      </div>
    </section>
  );
}

export function KpiCard({ title, value, subtitle, icon, tone = "blue" }) {
  const toneClasses = TONE_MAP[tone]?.card || TONE_MAP.blue.card;
  return (
    <div className={`rounded-[24px] border bg-gradient-to-br ${toneClasses} p-4 shadow-sm`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">{title}</p>
          <p className="mt-3 text-3xl font-black text-slate-900">{value}</p>
          {subtitle ? <p className="mt-2 text-xs font-semibold text-slate-600">{subtitle}</p> : null}
        </div>
        <div className="rounded-2xl bg-white/70 p-3 text-lg text-slate-700 shadow-sm">{icon}</div>
      </div>
    </div>
  );
}

export function Panel({ title, subtitle, actions = null, children, className = "" }) {
  return (
    <section className={`rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
      {(title || subtitle || actions) ? (
        <div className="mb-5 flex flex-col gap-3 border-b border-slate-100 pb-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            {title ? <h2 className="text-lg font-black text-slate-900">{title}</h2> : null}
            {subtitle ? <p className="mt-1 text-sm font-medium text-slate-500">{subtitle}</p> : null}
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function StatusChip({ label, tone = "slate" }) {
  const chip = TONE_MAP[tone]?.chip || TONE_MAP.slate.chip;
  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-black uppercase tracking-[0.18em] ${chip}`}>
      {label}
    </span>
  );
}

export function ActionButton({ children, tone = "slate", className = "", type = "button", ...props }) {
  const tones = {
    slate: "border-slate-200 bg-white text-slate-700 hover:bg-slate-100",
    blue: "border-blue-600 bg-blue-600 text-white hover:bg-blue-700",
    emerald: "border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700",
    amber: "border-amber-500 bg-amber-500 text-white hover:bg-amber-600",
  };

  return (
    <button
      type={type}
      className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-black transition ${tones[tone] || tones.slate} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function EmptyState({ title, subtitle }) {
  return (
    <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-slate-500 shadow-sm">
        <FaBoxOpen />
      </div>
      <p className="mt-4 text-base font-black text-slate-900">{title}</p>
      <p className="mt-2 text-sm font-medium text-slate-500">{subtitle}</p>
    </div>
  );
}

export function AttachmentInput({
  existingUrls,
  onExistingUrlsChange,
  newFiles,
  onNewFilesChange,
  label = "Anexos",
  accept = "image/*,video/*",
  helperText = "Aceita múltiplas fotos e vídeos.",
}) {
  const fileNames = useMemo(() => (newFiles || []).map((file) => file?.name).filter(Boolean), [newFiles]);

  function appendFiles(fileList) {
    const list = Array.from(fileList || []);
    if (list.length === 0) return;
    onNewFilesChange([...(newFiles || []), ...list]);
  }

  function removeNewFile(index) {
    onNewFilesChange((newFiles || []).filter((_, idx) => idx !== index));
  }

  function removeExisting(index) {
    onExistingUrlsChange((existingUrls || []).filter((_, idx) => idx !== index));
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-black text-slate-700">{label}</label>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-xs font-black text-slate-600 transition hover:bg-slate-100">
          <FaPlus />
          Adicionar arquivos
          <input
            type="file"
            multiple
            accept={accept}
            className="hidden"
            onChange={(event) => {
              appendFiles(event.target.files);
              event.target.value = "";
            }}
          />
        </label>
      </div>

      {helperText ? <p className="text-xs font-medium text-slate-500">{helperText}</p> : null}

      {existingUrls?.length ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Arquivos salvos</p>
          <div className="flex flex-wrap gap-2">
            {existingUrls.map((url, index) => (
              <span key={`${url}-${index}`} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700">
                <FaPaperclip className="text-slate-400" />
                <span className="max-w-[220px] truncate">{fileNameFromUrl(url)}</span>
                <button type="button" onClick={() => removeExisting(index)} className="text-slate-400 transition hover:text-rose-500">
                  <FaTimes />
                </button>
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {fileNames.length ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Novos arquivos</p>
          <div className="flex flex-wrap gap-2">
            {fileNames.map((name, index) => (
              <span key={`${name}-${index}`} className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700">
                <FaPaperclip />
                <span className="max-w-[220px] truncate">{name}</span>
                <button type="button" onClick={() => removeNewFile(index)} className="transition hover:text-rose-600">
                  <FaTimes />
                </button>
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function AttachmentGallery({ urls }) {
  const [viewerFile, setViewerFile] = useState(null);
  const items = useMemo(() => (Array.isArray(urls) ? urls.filter(Boolean) : []), [urls]);

  if (items.length === 0) {
    return <p className="text-sm font-medium text-slate-400">Sem anexos.</p>;
  }

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((url, index) => {
          const name = fileNameFromUrl(url);
          return (
            <button
              key={`${url}-${index}`}
              type="button"
              onClick={() => setViewerFile({ url, name })}
              className="group rounded-[20px] border border-slate-200 bg-slate-50 p-3 text-left transition hover:-translate-y-0.5 hover:bg-white hover:shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-600">Arquivo</p>
                  <p className="mt-2 truncate text-sm font-semibold text-slate-800">{name}</p>
                </div>
                <FaDownload className="text-slate-300 transition group-hover:text-slate-500" />
              </div>
            </button>
          );
        })}
      </div>

      <FileViewerModal
        open={Boolean(viewerFile?.url)}
        url={viewerFile?.url}
        name={viewerFile?.name}
        onClose={() => setViewerFile(null)}
      />
    </>
  );
}
