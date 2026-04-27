// src/pages/KMRodado.jsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../supabase";
import { FaPlus, FaEdit, FaTrash, FaSave, FaTimes, FaSyncAlt } from "react-icons/fa";

function todayYMD_SP() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;
  return `${y}-${m}-${d}`;
}

export default function KMRodado() {
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");

  const [rows, setRows] = useState([]);

  // Modal (Add/Edit)
  const [open, setOpen] = useState(false);
  const [modo, setModo] = useState("add"); // "add" | "edit"
  const [formData, setFormData] = useState(todayYMD_SP());
  const [formKm, setFormKm] = useState("");

  const tituloModal = useMemo(() => (modo === "edit" ? "Editar KM do dia" : "Adicionar KM do dia"), [modo]);

  async function carregar() {
    setLoading(true);
    setErro("");
    try {
      const { data, error } = await supabase
        .from("km_rodado_diario")
        .select("id, data, km_total, created_at, updated_at")
        .order("data", { ascending: false });

      if (error) throw error;
      setRows(data || []);
    } catch (e) {
      setErro(e?.message || "Erro ao carregar KM rodado.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  function abrirAdd() {
    setModo("add");
    setFormData(todayYMD_SP());
    setFormKm("");
    setOpen(true);
  }

  function abrirEdit(r) {
    setModo("edit");
    setFormData(r.data);
    setFormKm(String(r.km_total ?? ""));
    setOpen(true);
  }

  function fechar() {
    setOpen(false);
    setErro("");
  }

  async function salvar() {
    if (!formData) {
      alert("Selecione a data.");
      return;
    }
    const kmNum = Number(String(formKm).replace(",", "."));
    if (!Number.isFinite(kmNum) || kmNum < 0) {
      alert("Informe um KM válido.");
      return;
    }

    setLoading(true);
    setErro("");
    try {
      // Upsert por "data" (único)
      const { error } = await supabase
        .from("km_rodado_diario")
        .upsert({ data: formData, km_total: kmNum }, { onConflict: "data" });

      if (error) throw error;

      setOpen(false);
      await carregar();
    } catch (e) {
      setErro(e?.message || "Erro ao salvar.");
    } finally {
      setLoading(false);
    }
  }

  async function excluir(r) {
    const ok = window.confirm(`Excluir o KM do dia ${r.data}?`);
    if (!ok) return;

    setLoading(true);
    setErro("");
    try {
      const { error } = await supabase.from("km_rodado_diario").delete().eq("id", r.id);
      if (error) throw error;
      await carregar();
    } catch (e) {
      setErro(e?.message || "Erro ao excluir.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h1 className="text-2xl font-bold text-gray-800">KM Rodado (Dia)</h1>

        <div className="flex items-center gap-2">
          <button
            onClick={carregar}
            disabled={loading}
            className="bg-blue-600 text-white px-3 py-2 rounded-md hover:bg-blue-700 flex items-center gap-2 disabled:opacity-60"
          >
            <FaSyncAlt />
            {loading ? "Carregando..." : "Recarregar"}
          </button>

          <button
            onClick={abrirAdd}
            disabled={loading}
            className="bg-green-600 text-white px-3 py-2 rounded-md hover:bg-green-700 flex items-center gap-2 disabled:opacity-60"
          >
            <FaPlus />
            Adicionar dia
          </button>
        </div>
      </div>

      {erro && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded">
          {erro}
        </div>
      )}

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="p-4 border-b">
          <p className="text-sm text-gray-600">
            Registre o KM rodado do dia. Você pode editar depois.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-blue-600 text-white">
              <tr>
                <th className="py-3 px-4 text-left">Data</th>
                <th className="py-3 px-4 text-left">KM rodado</th>
                <th className="py-3 px-4 text-left">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="3" className="text-center py-6 text-gray-600">
                    Carregando...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan="3" className="text-center py-6 text-gray-600">
                    Nenhum registro ainda.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="border-t hover:bg-gray-50">
                    <td className="py-3 px-4">{r.data}</td>
                    <td className="py-3 px-4">{Number(r.km_total ?? 0).toLocaleString("pt-BR")}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => abrirEdit(r)}
                          className="bg-gray-800 text-white px-3 py-2 rounded-md hover:bg-gray-900 flex items-center gap-2"
                        >
                          <FaEdit /> Editar
                        </button>
                        <button
                          onClick={() => excluir(r)}
                          className="bg-red-600 text-white px-3 py-2 rounded-md hover:bg-red-700 flex items-center gap-2"
                        >
                          <FaTrash /> Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="p-3 border-t text-xs text-gray-500">
          Total de dias cadastrados: <strong>{rows.length}</strong>
        </div>
      </div>

      {/* Modal simples */}
      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md overflow-hidden">
            <div className="p-4 border-b flex items-center justify-between">
              <h2 className="font-semibold text-gray-800">{tituloModal}</h2>
              <button onClick={fechar} className="text-gray-600 hover:text-gray-900">
                <FaTimes />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Data</label>
                <input
                  type="date"
                  value={formData}
                  onChange={(e) => setFormData(e.target.value)}
                  className="border rounded-md px-3 py-2 w-full"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">KM rodado</label>
                <input
                  type="number"
                  value={formKm}
                  onChange={(e) => setFormKm(e.target.value)}
                  className="border rounded-md px-3 py-2 w-full"
                  placeholder="Ex.: 18500"
                  min="0"
                  step="0.01"
                />
              </div>
            </div>

            <div className="p-4 border-t flex items-center justify-end gap-2">
              <button
                onClick={fechar}
                disabled={loading}
                className="bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300 disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                onClick={salvar}
                disabled={loading}
                className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 flex items-center gap-2 disabled:opacity-60"
              >
                <FaSave /> Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
