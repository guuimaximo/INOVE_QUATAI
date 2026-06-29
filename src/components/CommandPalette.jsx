import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, CornerDownLeft, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useAccessGovernance } from "../context/AccessContext";
import { getAccessPages, canUserAccessPageKey } from "../utils/access";

function normalize(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

// Busca global estilo "command palette" (Ctrl/Cmd+K). Lista todas as telas que
// o usuario PODE acessar (mesmo catalogo + permissoes do menu) e navega ao
// escolher. Abre tambem pelo evento "inove:open-search".
export default function CommandPalette() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profileMap } = useAccessGovernance();

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const pages = useMemo(() => {
    return getAccessPages()
      .filter((p) => p?.path && !p.path.includes(":")) // sem telas de detalhe (precisam de id)
      .filter((p) => canUserAccessPageKey(user, p.key, profileMap));
  }, [user, profileMap]);

  const results = useMemo(() => {
    const q = normalize(query);
    if (!q) return pages.slice(0, 50);
    return pages
      .filter((p) => normalize(p.label).includes(q) || normalize(p.category).includes(q))
      .slice(0, 50);
  }, [pages, query]);

  useEffect(() => {
    function onKey(event) {
      const k = event.key?.toLowerCase();
      if ((event.ctrlKey || event.metaKey) && k === "k") {
        event.preventDefault();
        setOpen((v) => !v);
      }
    }
    function onOpenEvent() {
      setOpen(true);
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("inove:open-search", onOpenEvent);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("inove:open-search", onOpenEvent);
    };
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  function go(page) {
    if (!page) return;
    setOpen(false);
    navigate(page.path);
  }

  function onInputKey(event) {
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      go(results[active]);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center bg-slate-950/40 px-4 pt-[14vh]"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-slate-100 px-4">
          <Search size={18} className="text-slate-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKey}
            placeholder="Buscar tela... (ex.: pneus, contagem, avarias)"
            className="w-full bg-transparent py-3.5 text-sm text-slate-800 outline-none placeholder:text-slate-400"
          />
          <button type="button" onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-700">
            <X size={18} />
          </button>
        </div>

        <div ref={listRef} className="max-h-[52vh] overflow-y-auto py-1">
          {results.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-slate-400">Nenhuma tela encontrada.</div>
          ) : (
            results.map((p, i) => (
              <button
                key={p.key}
                type="button"
                onMouseEnter={() => setActive(i)}
                onClick={() => go(p)}
                className={`flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm ${
                  i === active ? "bg-blue-50 text-blue-800" : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                <span className="font-medium">{p.label}</span>
                <span className="shrink-0 text-xs text-slate-400">{p.category}</span>
              </button>
            ))
          )}
        </div>

        <div className="flex items-center gap-4 border-t border-slate-100 bg-slate-50 px-4 py-2 text-[11px] text-slate-400">
          <span className="inline-flex items-center gap-1"><CornerDownLeft size={12} /> abrir</span>
          <span>↑ ↓ navegar</span>
          <span>Esc fechar</span>
          <span className="ml-auto">Ctrl + K</span>
        </div>
      </div>
    </div>
  );
}
