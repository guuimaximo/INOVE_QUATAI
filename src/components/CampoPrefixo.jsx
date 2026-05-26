import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";

export default function CampoPrefixo({
  value,
  onChange,
  onChangeCluster,
  label = "Prefixo",
  placeholder = "Digite o prefixo...",
  inputMode = "text",
  pattern,
}) {
  const [todos, setTodos] = useState([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [errorLoading, setErrorLoading] = useState(null);

  function normalizePrefixSearch(text) {
    return String(text || "").trim().toLowerCase().replace(/^w/, "");
  }

  function buildMatches(text, rows) {
    const normalized = normalizePrefixSearch(text);
    if (!normalized || !Array.isArray(rows)) return [];

    const starts = [];
    const contains = [];

    rows.forEach((p) => {
      const codigo = normalizePrefixSearch(p.codigo);
      if (!codigo) return;
      if (codigo.startsWith(normalized)) starts.push(p);
      else if (codigo.includes(normalized)) contains.push(p);
    });

    return [...starts, ...contains]
      .slice(0, 8);
  }

  useEffect(() => {
    setErrorLoading(null);

    (async () => {
      const { data, error } = await supabase
        .from("prefixos")
        .select("id, codigo, cluster")
        .order("codigo", { ascending: true });

      if (error) {
        console.error("Erro ao buscar prefixos:", error);
        setErrorLoading("Falha ao carregar prefixos. Verifique o console.");
        setTodos([]);
      } else {
        setTodos(data || []);
      }
    })();
  }, []);

  const filtrados = useMemo(() => buildMatches(q, todos), [q, todos]);

  const mapByCodigo = useMemo(() => {
    const map = new Map();
    (todos || []).forEach((p) => {
      const codigo = String(p?.codigo || "").trim();
      if (!codigo) return;
      map.set(codigo, p);
      map.set(normalizePrefixSearch(codigo), p);
    });
    return map;
  }, [todos]);

  useEffect(() => {
    const nextValue = String(value || "");
    setQ((current) => (current === nextValue ? current : nextValue));
  }, [value]);

  function aplicar(prefixo) {
    const codigo = String(prefixo?.codigo || "").trim();
    onChange?.(codigo);
    setQ(codigo);

    if (onChangeCluster) {
      onChangeCluster(String(prefixo?.cluster || "").trim());
    }

    setOpen(false);
  }

  function handleInputChange(nextValue) {
    setQ(nextValue);
    onChange?.(nextValue);

    if (onChangeCluster) {
      const row =
        mapByCodigo.get(String(nextValue || "").trim()) ||
        mapByCodigo.get(normalizePrefixSearch(nextValue));
      onChangeCluster(String(row?.cluster || "").trim());
    }

    setOpen(buildMatches(nextValue, todos).length > 0);
  }

  return (
    <div className="relative">
      {label ? <label className="mb-1 block text-sm text-gray-600">{label}</label> : null}

      <input
        className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        placeholder={errorLoading ? "Erro ao carregar" : placeholder}
        value={q}
        inputMode={inputMode}
        pattern={pattern}
        onChange={(e) => handleInputChange(e.target.value)}
        onFocus={() => {
          if (q && filtrados.length > 0) setOpen(true);
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        required
        disabled={Boolean(errorLoading)}
      />

      {errorLoading ? <div className="mt-1 text-xs text-red-600">{errorLoading}</div> : null}

      {open && filtrados.length > 0 ? (
        <div className="absolute z-50 mt-1 max-h-72 w-full overflow-auto rounded-xl border border-slate-200 bg-white shadow-xl">
          {filtrados.map((prefixo) => (
            <button
              key={prefixo.id}
              type="button"
              onMouseDown={() => aplicar(prefixo)}
              className="block w-full px-3 py-2 text-left hover:bg-blue-50"
            >
              <div className="text-sm font-bold text-slate-800">{prefixo.codigo}</div>
              {prefixo.cluster ? <div className="text-xs font-semibold text-slate-500">Cluster: {prefixo.cluster}</div> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
