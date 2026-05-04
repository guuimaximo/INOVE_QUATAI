// src/components/CampoPrefixo.jsx
// (Corrigido para usar a coluna 'codigo' + retornar cluster quando existir)

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";

export default function CampoPrefixo({
  value,
  onChange,
  onChangeCluster, // ✅ novo (opcional)
  label = "Prefixo",
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

  // 1. Carrega todos os prefixos (agora inclui cluster)
  useEffect(() => {
    setErrorLoading(null);
    (async () => {
      const { data, error } = await supabase
        .from("prefixos")
        .select("id, codigo, cluster") // ✅ inclui cluster
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

  // 2. Filtra os prefixos
  const filtrados = useMemo(() => {
    const s = normalizePrefixSearch(q);
    if (!s) return [];
    if (!Array.isArray(todos)) return [];

    return todos
      .filter((p) => normalizePrefixSearch(p.codigo).startsWith(s))
      .slice(0, 8);
  }, [q, todos]);

  // 3. Abre/fecha dropdown
  useEffect(() => {
    if (!String(q || "")) {
      setOpen(false);
      return;
    }
    setOpen(filtrados.length > 0);
  }, [q, filtrados.length]);

  // ✅ Mapa rápido para achar cluster quando digitar o código completo
  const mapByCodigo = useMemo(() => {
    const m = new Map();
    (todos || []).forEach((p) => {
      const cod = String(p?.codigo || "").trim();
      if (cod) m.set(cod, p);
      const normalized = normalizePrefixSearch(cod);
      if (normalized) m.set(normalized, p);
    });
    return m;
  }, [todos]);

  // 4. Aplica a seleção (dropdown)
  function aplicar(p) {
    const cod = String(p?.codigo || "").trim();
    onChange?.(cod);
    setQ(cod);

    // ✅ devolve cluster junto, se o pai quiser
    if (onChangeCluster) {
      const cl = String(p?.cluster || "").trim();
      onChangeCluster(cl);
    }

    setOpen(false);
  }

  // 5. Sincroniza o input com value externo
  useEffect(() => {
    setQ(String(value || ""));
  }, [value]);

  // ✅ Quando digitar, atualiza value e tenta resolver cluster se tiver match exato
  function handleInputChange(v) {
    setQ(v);
    onChange?.(v);

    if (onChangeCluster) {
      const row = mapByCodigo.get(String(v || "").trim()) || mapByCodigo.get(normalizePrefixSearch(v));
      const cl = String(row?.cluster || "").trim();
      onChangeCluster(cl);
    }
  }

  return (
    <div className="relative">
      <label className="block text-sm text-gray-600 mb-1">{label}</label>

      <input
        className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        placeholder={errorLoading ? "Erro ao carregar" : "Digite o prefixo…"}
        value={q}
        inputMode={inputMode}
        pattern={pattern}
        onChange={(e) => handleInputChange(e.target.value)}
        onFocus={() => {
          if (q && filtrados.length > 0) setOpen(true);
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        required
        disabled={!!errorLoading}
      />

      {errorLoading && <div className="text-red-600 text-xs mt-1">{errorLoading}</div>}

      {open && filtrados.length > 0 && (
        <div className="absolute z-10 mt-1 w-full rounded-md border bg-white shadow">
          {filtrados.map((p) => (
            <button
              key={p.id}
              type="button"
              onMouseDown={() => aplicar(p)}
              className="block w-full text-left px-3 py-2 hover:bg-gray-100"
            >
              <div className="text-sm font-medium">{p.codigo}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
