import { useEffect, useMemo, useRef, useState } from "react";
import {
  FaBoxOpen,
  FaDownload,
  FaPaperclip,
  FaPlus,
  FaTimes,
} from "react-icons/fa";
import FileViewerModal from "../../components/FileViewerModal";
import { supabase } from "../../supabase";
import { fileNameFromUrl } from "./suprimentosShared";

function isImageUrl(url) {
  const value = String(url || "").toLowerCase();
  return /\.(png|jpe?g|gif|webp|bmp|svg)(\?|#|$)/.test(value);
}

function isPdfUrl(url) {
  const value = String(url || "").toLowerCase();
  return value.includes(".pdf") || /\.(pdf)(\?|#|$)/.test(value);
}

function isVideoUrl(url) {
  const value = String(url || "").toLowerCase();
  return /\.(mp4|mov|webm|ogg)(\?|#|$)/.test(value);
}

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
    <section className="rounded-xl border border-slate-200 bg-white px-6 py-6 shadow-sm">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-blue-500">{eyebrow}</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
          {description ? <p className="mt-1.5 max-w-2xl text-sm font-normal leading-6 text-slate-500">{description}</p> : null}
        </div>

        {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
      </div>
    </section>
  );
}

export function KpiCard({ title, value, subtitle, icon, tone = "blue" }) {
  const toneClasses = TONE_MAP[tone]?.card || TONE_MAP.blue.card;
  return (
    <div className={`rounded-xl border bg-gradient-to-br ${toneClasses} p-4 shadow-sm`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">{title}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">{value}</p>
          {subtitle ? <p className="mt-1.5 text-xs font-normal text-slate-500">{subtitle}</p> : null}
        </div>
        <div className="rounded-xl bg-white/70 p-3 text-lg text-slate-700 shadow-sm">{icon}</div>
      </div>
    </div>
  );
}

export function Panel({ title, subtitle, actions = null, children, className = "" }) {
  return (
    <section className={`rounded-xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
      {(title || subtitle || actions) ? (
        <div className="mb-5 flex flex-col gap-3 border-b border-slate-100 pb-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            {title ? <h2 className="text-lg font-semibold text-slate-900">{title}</h2> : null}
            {subtitle ? <p className="mt-1 text-sm font-medium text-slate-500">{subtitle}</p> : null}
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function StatusChip({ label, tone = "slate", children }) {
  const chip = TONE_MAP[tone]?.chip || TONE_MAP.slate.chip;
  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${chip}`}>
      {label ?? children}
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
      className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${tones[tone] || tones.slate} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

function normalizeSearch(value = "") {
  return String(value || "").trim().replace(/[,%]/g, " ");
}

function supplierNameFromPart(part) {
  const relation = part?.suprimentos_fornecedores;
  if (Array.isArray(relation)) return relation[0]?.nome || "";
  return relation?.nome || "";
}

function uniqueSuppliers(rows = []) {
  const map = new Map();
  rows.forEach((row) => {
    const key = String(row?.id || row?.nome || "").trim().toLowerCase();
    if (!key || map.has(key)) return;
    map.set(key, row);
  });
  return Array.from(map.values());
}

function uniqueParts(rows = []) {
  const map = new Map();
  rows.forEach((row) => {
    const code = String(row?.codigo || "").trim().toLowerCase();
    const description = String(row?.descricao || "").trim().toLowerCase();
    const key = `${code}|${description}`;
    if (!description) return;

    const current = map.get(key);
    if (!current || (!supplierNameFromPart(current) && supplierNameFromPart(row))) {
      map.set(key, row);
    }
  });
  return Array.from(map.values());
}

function useClickOutside(close) {
  const ref = useRef(null);

  useEffect(() => {
    function handler(event) {
      if (ref.current && !ref.current.contains(event.target)) close?.();
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [close]);

  return ref;
}

export function SupplierAutocomplete({
  value,
  onChange,
  onSelect,
  className = "",
  placeholder = "Fornecedor",
  limit = 20,
  disabled = false,
  required = false,
}) {
  const [options, setOptions] = useState([]);
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef(null);
  const wrapperRef = useClickOutside(() => setShow(false));

  async function search(rawValue = "") {
    const query = normalizeSearch(rawValue);
    setLoading(true);
    let request = supabase
      .from("suprimentos_fornecedores")
      .select("id, nome, cnpj, telefone, email, contato")
      .eq("ativo", true)
      .order("nome")
      .limit(limit);

    if (query) {
      request = request.or(`nome.ilike.%${query}%,cnpj.ilike.%${query}%,telefone.ilike.%${query}%`);
    }

    const { data } = await request;
    setOptions(uniqueSuppliers(data || []));
    setLoading(false);
  }

  function scheduleSearch(nextValue) {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => void search(nextValue), 250);
  }

  function selectOption(option) {
    onChange?.(option.nome || "");
    onSelect?.(option);
    setShow(false);
  }

  return (
    <div ref={wrapperRef} className="relative">
      <input
        className={className}
        value={value || ""}
        autoComplete="off"
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        onChange={(event) => {
          onChange?.(event.target.value);
          setShow(true);
          scheduleSearch(event.target.value);
        }}
        onFocus={() => {
          setShow(true);
          void search(value);
        }}
      />

      {show ? (
        <div className="absolute z-50 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl">
          {loading ? (
            <div className="px-4 py-3 text-sm font-semibold text-slate-400">Buscando...</div>
          ) : options.length > 0 ? (
            options.map((option) => (
              <button
                key={option.id}
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault();
                  selectOption(option);
                }}
                className="flex w-full flex-col gap-0.5 border-b border-slate-50 px-4 py-2.5 text-left last:border-0 hover:bg-blue-50/60"
              >
                <p className="truncate text-sm font-medium text-slate-900">{option.nome}</p>
                <p className="truncate text-[11px] font-normal text-slate-500">
                  {[option.cnpj, option.telefone].filter(Boolean).join(" · ") || "Fornecedor cadastrado"}
                </p>
              </button>
            ))
          ) : (
            <div className="px-4 py-3 text-sm font-semibold text-slate-400">Nenhum fornecedor encontrado.</div>
          )}
        </div>
      ) : null}
    </div>
  );
}

export function PartAutocomplete({
  value,
  onChange,
  onSelect,
  className = "",
  placeholder = "Peca",
  limit = 30,
  disabled = false,
  required = false,
}) {
  const [options, setOptions] = useState([]);
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef(null);
  const wrapperRef = useClickOutside(() => setShow(false));

  async function search(rawValue = "") {
    const query = normalizeSearch(rawValue);
    setLoading(true);
    let request = supabase
      .from("suprimentos_pecas")
      .select("id, codigo, descricao, unidade_padrao, fornecedor_id, suprimentos_fornecedores(nome, cnpj, telefone)")
      .eq("ativo", true)
      .order("descricao")
      .limit(limit);

    if (query) {
      request = request.or(`descricao.ilike.%${query}%,codigo.ilike.%${query}%`);
    }

    const { data } = await request;
    setOptions(uniqueParts(data || []));
    setLoading(false);
  }

  function scheduleSearch(nextValue) {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => void search(nextValue), 250);
  }

  function selectOption(option) {
    onChange?.(option.descricao || "");
    onSelect?.({
      ...option,
      fornecedor_nome: supplierNameFromPart(option),
    });
    setShow(false);
  }

  return (
    <div ref={wrapperRef} className="relative">
      <input
        className={className}
        value={value || ""}
        autoComplete="off"
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        onChange={(event) => {
          onChange?.(event.target.value);
          setShow(true);
          scheduleSearch(event.target.value);
        }}
        onFocus={() => {
          setShow(true);
          void search(value);
        }}
      />

      {show ? (
        <div className="absolute z-50 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl">
          {loading ? (
            <div className="px-4 py-3 text-sm font-semibold text-slate-400">Buscando...</div>
          ) : options.length > 0 ? (
            options.map((option) => (
              <button
                key={option.id}
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault();
                  selectOption(option);
                }}
                className="flex w-full flex-col gap-0.5 border-b border-slate-50 px-4 py-2.5 text-left last:border-0 hover:bg-blue-50/60"
              >
                <p className="truncate text-sm font-medium text-slate-900">{option.descricao}</p>
                <p className="truncate text-[11px] font-normal text-slate-500">
                  <span className="font-mono text-slate-400">{option.codigo || "--"}</span>
                  {supplierNameFromPart(option) ? ` · ${supplierNameFromPart(option)}` : ""}
                  {option.unidade_padrao ? ` · ${option.unidade_padrao}` : ""}
                </p>
              </button>
            ))
          ) : (
            <div className="px-4 py-3 text-sm font-semibold text-slate-400">Nenhuma peca encontrada.</div>
          )}
        </div>
      ) : null}
    </div>
  );
}

export function EmptyState({ title, subtitle }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-white text-slate-500 shadow-sm">
        <FaBoxOpen />
      </div>
      <p className="mt-4 text-base font-semibold text-slate-900">{title}</p>
      <p className="mt-2 text-sm font-medium text-slate-500">{subtitle}</p>
    </div>
  );
}

export function AttachmentInput({
  existingUrls,
  onExistingUrlsChange,
  newFiles,
  onNewFilesChange,
  label = "Evidências (Fotos, Vídeos e PDF)",
  accept = "image/*,video/*,application/pdf",
  helperText = "",
}) {
  const fileNames = useMemo(() => (newFiles || []).map((file) => file?.name).filter(Boolean), [newFiles]);
  const inputRef = useRef(null);

  function appendFiles(fileList) {
    const list = Array.from(fileList || []);
    if (list.length === 0) return;
    onNewFilesChange([...(newFiles || []), ...list]);
  }

  function handlePaste(event) {
    const items = Array.from(event.clipboardData?.items || []);
    const pasted = items
      .filter((item) => item.kind === "file" && String(item.type || "").startsWith("image/"))
      .map((item) => {
        const file = item.getAsFile();
        if (!file) return null;
        const ext = file.type === "image/png" ? "png" : file.type === "image/jpeg" ? "jpg" : "img";
        return new File([file], `print_${new Date().toISOString().replace(/[:.]/g, "-")}.${ext}`, {
          type: file.type,
          lastModified: Date.now(),
        });
      })
      .filter(Boolean);
    if (!pasted.length) return;
    event.preventDefault();
    appendFiles(pasted);
  }

  function removeNewFile(index) {
    onNewFilesChange((newFiles || []).filter((_, idx) => idx !== index));
  }

  function removeExisting(index) {
    onExistingUrlsChange((existingUrls || []).filter((_, idx) => idx !== index));
  }

  const total = (existingUrls?.length || 0) + fileNames.length;

  return (
    <div className="space-y-3">
      {label ? <p className="text-sm font-medium text-slate-700">{label}</p> : null}

      <div className="grid gap-3 md:grid-cols-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex min-h-[120px] flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center transition hover:border-blue-300 hover:bg-blue-50/40"
        >
          <p className="text-sm text-slate-600">
            <span className="font-semibold text-slate-800">Clique para enviar</span> ou arraste e solte
          </p>
          <p className="mt-1 text-xs text-slate-500">PNG, JPG, MP4, MOV ou PDF</p>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={accept}
            className="hidden"
            onChange={(event) => {
              appendFiles(event.target.files);
              event.target.value = "";
            }}
          />
        </button>

        <div
          role="button"
          tabIndex={0}
          onPaste={handlePaste}
          className="flex min-h-[120px] flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 text-center outline-none transition focus:border-blue-400 focus:bg-blue-50"
        >
          <p className="text-sm text-slate-700">Clique aqui e cole seu print.</p>
          <p className="mt-1 text-xs text-slate-500">Somente imagens do clipboard serão adicionadas.</p>
        </div>
      </div>

      {helperText ? <p className="text-xs font-medium text-slate-500">{helperText}</p> : null}

      {total === 0 ? (
        <p className="text-xs font-medium text-rose-400">Nenhuma evidência anexada ainda</p>
      ) : null}

      {existingUrls?.length ? (
        <div className="space-y-2">
          <p className="text-xs font-medium tracking-wide text-slate-400">Arquivos salvos</p>
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
          <p className="text-xs font-medium tracking-wide text-slate-400">Novos arquivos</p>
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
          const image = isImageUrl(url);
          const video = isVideoUrl(url);
          const pdf = isPdfUrl(url);

          return (
            <button
              key={`${url}-${index}`}
              type="button"
              onClick={() => setViewerFile({ url, name })}
              className="group overflow-hidden rounded-xl border border-slate-200 bg-slate-50 text-left transition hover:-translate-y-0.5 hover:bg-white hover:shadow-sm"
            >
              {image ? (
                <>
                  <img
                    src={url}
                    alt={name}
                    className="h-28 w-full object-cover"
                    loading="lazy"
                  />
                  <div className="flex items-start justify-between gap-3 p-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">Imagem</p>
                      <p className="mt-2 truncate text-sm font-semibold text-slate-800">{name}</p>
                    </div>
                    <FaDownload className="text-slate-300 transition group-hover:text-slate-500" />
                  </div>
                </>
              ) : video ? (
                <>
                  <video src={url} className="h-28 w-full object-cover" muted />
                  <div className="flex items-start justify-between gap-3 p-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">Video</p>
                      <p className="mt-2 truncate text-sm font-semibold text-slate-800">{name}</p>
                    </div>
                    <FaDownload className="text-slate-300 transition group-hover:text-slate-500" />
                  </div>
                </>
              ) : (
                <div className="flex items-start justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">
                      {pdf ? "PDF" : "Arquivo"}
                    </p>
                    <p className="mt-2 truncate text-sm font-semibold text-slate-800">{name}</p>
                  </div>
                  <FaDownload className="text-slate-300 transition group-hover:text-slate-500" />
                </div>
              )}
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
