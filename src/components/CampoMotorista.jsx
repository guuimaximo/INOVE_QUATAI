// src/components/CampoMotorista.jsx
// (Correção no useMemo + suporte a disabled)

import { useEffect, useMemo, useState } from "react";
import { listarFuncionariosAtivos } from "../utils/funcionariosBCNT";

export default function CampoMotorista({
  value,
  onChange,
  label = "Motorista",
  disabled = false,
}) {
  const [todos, setTodos] = useState([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [errorLoading, setErrorLoading] = useState(null);

  // 1. Carrega motoristas
  useEffect(() => {
    setErrorLoading(null);
    (async () => {
      try {
        const data = await listarFuncionariosAtivos({
          columns: "id_funcionario, nr_cracha, nm_funcionario, status",
          from: 0,
          to: 9999,
        });
        setTodos(data || []);
      } catch (error) {
        console.error("Erro ao buscar motoristas:", error);
        setErrorLoading("Falha ao carregar motoristas.");
        setTodos([]);
      }
    })();
  }, []);

  // 3. Filtra motoristas
  const filtrados = useMemo(() => {
    const s = String(q || "").trim().toLowerCase();
    if (!s) return [];
    if (!Array.isArray(todos)) return [];

    return todos
      .filter(
        (m) =>
          String(m.chapa || "").toLowerCase().startsWith(s) ||
          String(m.nome || "").toLowerCase().includes(s)
      )
      .slice(0, 8);
  }, [q, todos]);

  // 2. Abre dropdown (dependendo de q)
  useEffect(() => {
    if (!String(q || "")) {
      setOpen(false);
      return;
    }
    setOpen(!disabled && filtrados.length > 0);
  }, [q, disabled, filtrados.length]);

  // 4. Aplica seleção
  function aplicar(m) {
    onChange?.({ chapa: String(m.chapa), nome: m.nome });
    setQ(`${m.chapa} - ${m.nome}`);
    setOpen(false);
  }

  // 5. Sincroniza input
  useEffect(() => {
    if (!value || (!value.chapa && !value.nome)) {
      setQ("");
      return;
    }
    const texto = [value.chapa, value.nome].filter(Boolean).join(" - ");
    setQ(texto);
  }, [value]);

  return (
    <div className="relative">
      <label className="block text-sm text-gray-600 mb-1">{label}</label>
      <input
        className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
        placeholder={errorLoading ? "Erro ao carregar" : "Digite a chapa ou nome…"}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => {
          if (!disabled && q && filtrados.length > 0) setOpen(true);
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        disabled={!!errorLoading || disabled}
      />
      {errorLoading && <div className="text-red-600 text-xs mt-1">{errorLoading}</div>}
      {open && filtrados.length > 0 && (
        <div className="absolute z-10 mt-1 w-full rounded-md border bg-white shadow">
          {filtrados.map((m) => (
            <button
              key={m.chapa}
              type="button"
              onMouseDown={() => aplicar(m)}
              className="block w-full text-left px-3 py-2 hover:bg-gray-100"
            >
              <div className="text-sm font-medium">{m.nome}</div>
              <div className="text-xs text-gray-500">Chapa: {m.chapa}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
