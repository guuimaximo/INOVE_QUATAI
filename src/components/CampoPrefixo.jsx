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

  const [aviso, setAviso] = useState("");

  function handleInputChange(nextValue) {
    const truncated = String(nextValue || "").slice(0, 6);
    setQ(truncated);
    onChange?.(truncated);
    setAviso("");

    if (onChangeCluster) {
      const row =
        mapByCodigo.get(String(truncated || "").trim()) ||
        mapByCodigo.get(normalizePrefixSearch(truncated));
      onChangeCluster(String(row?.cluster || "").trim());
    }

    setOpen(buildMatches(truncated, todos).length > 0);
  }

  function handleBlur() {
    setTimeout(() => setOpen(false), 150);
    const raw = String(q || "").trim();
    if (!raw || todos.length === 0) { setAviso(""); return; }
    const exact = mapByCodigo.get(raw) || mapByCodigo.get(normalizePrefixSearch(raw));
    if (exact) {
      if (exact.codigo !== raw) {
        setQ(exact.codigo);
        onChange?.(exact.codigo);
        if (onChangeCluster) onChangeCluster(String(exact.cluster || "").trim());
      }
      setAviso("");
      return;
    }
    const numOnly = raw.replace(/\D/g, "");
    if (numOnly) {
      const match = todos.find((p) => String(p.codigo || "").replace(/\D/g, "") === numOnly);
      if (match) {
        setQ(match.codigo);
        onChange?.(match.codigo);
        if (onChangeCluster) onChangeCluster(String(match.cluster || "").trim());
        setAviso("");
        return;
      }
    }
    setAviso("Veiculo nao encontrado no sistema.");
  }

  return (
    <div className="relative">
      {label ? <label className="mb-1 block text-sm text-gray-600">{label}</label> : null}

      <input
        className={`w-full rounded-md border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${aviso ? "border-red-400" : "border-gray-300"}`}
        placeholder={errorLoading ? "Erro ao carregar" : placeholder}
        value={q}
        maxLength={6}
        inputMode={inputMode}
        pattern={pattern}
        onChange={(e) => handleInputChange(e.target.value)}
        onFocus={() => {
          if (q && filtrados.length > 0) setOpen(true);
        }}
        onBlur={handleBlur}
        required
        disabled={Boolean(errorLoading)}
      />

      {aviso ? <div className="mt-1 text-xs text-red-600">{aviso}</div> : null}
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
