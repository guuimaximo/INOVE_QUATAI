import { useRef, useState } from "react";
import { FaFileUpload } from "react-icons/fa";

function buildPastedFile(file) {
  const ext = file.type === "image/png" ? "png" : file.type === "image/jpeg" ? "jpg" : "img";
  return new File([file], `print_${new Date().toISOString().replace(/[:.]/g, "-")}.${ext}`, {
    type: file.type,
    lastModified: Date.now(),
  });
}

export default function PasteEvidenceBox({
  files,
  onFilesChange,
  title = "Clique ou cole o print aqui",
  hint = "Use Ctrl+V para colar prints ou clique para anexar imagens, videos e PDF.",
  accept = "image/*,video/*,application/pdf",
  icon = <FaFileUpload />,
}) {
  const inputRef = useRef(null);
  const [focused, setFocused] = useState(false);
  const list = Array.from(files || []);

  function addFiles(nextFiles) {
    const incoming = Array.from(nextFiles || []).filter(Boolean);
    if (!incoming.length) return;
    onFilesChange?.([...list, ...incoming]);
  }

  function handlePaste(event) {
    const items = Array.from(event.clipboardData?.items || []);
    const pasted = items
      .filter((item) => item.kind === "file" && String(item.type || "").startsWith("image/"))
      .map((item) => item.getAsFile())
      .filter(Boolean)
      .map(buildPastedFile);

    if (!pasted.length) return;
    event.preventDefault();
    addFiles(pasted);
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") inputRef.current?.click();
      }}
      onPaste={handlePaste}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      className={`flex cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed px-4 py-8 text-center outline-none transition ${
        focused ? "border-blue-400 bg-blue-50" : "border-slate-200 bg-slate-50 hover:border-blue-300 hover:bg-blue-50/40"
      }`}
    >
      <div className="mb-2 text-2xl text-slate-400">{icon}</div>
      <span className="text-sm font-black text-slate-700">{title}</span>
      <span className="mt-1 text-xs font-semibold text-slate-500">
        {list.length ? `${list.length} arquivo(s) selecionado(s)` : hint}
      </span>
      {list.length ? (
        <div className="mt-3 flex max-w-full flex-wrap justify-center gap-2">
          {list.slice(0, 6).map((file, index) => (
            <span key={`${file.name}-${file.size}-${index}`} className="max-w-[180px] truncate rounded-full border border-blue-200 bg-white px-3 py-1 text-xs font-bold text-blue-700">
              {file.name}
            </span>
          ))}
        </div>
      ) : null}
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={accept}
        className="hidden"
        onChange={(event) => addFiles(event.target.files)}
      />
    </div>
  );
}
