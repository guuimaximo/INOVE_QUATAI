import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";
import { FaTimes } from "react-icons/fa";
import CampoMotorista from "./CampoMotorista";

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function safeArray(v) {
  if (Array.isArray(v)) return v.filter(Boolean);
  return [];
}

function buildStoragePath(avariaId, chapa, fileName) {
  const ext = fileName.includes(".") ? fileName.split(".").pop() : "bin";
  const rand = Math.random().toString(36).slice(2);
  return `avaria-${avariaId}/chamados/${chapa || "sem_chapa"}/${Date.now()}-${rand}.${ext}`;
}

export default function ChamadosMotoristasModal({ avariaId, onClose }) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [savingId, setSavingId] = useState(null);
  const [uploadingId, setUploadingId] = useState(null);

  const blankRow = () => ({
    __tempId: `tmp_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    id: null, // id real do banco
    motorista: { chapa: "", nome: "" }, // CampoMotorista
    data_chamado: todayISO(),
    data_evidencia: "",
    evidencias_urls: [],
  });

  const load = async () => {
    if (!avariaId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("avarias_motoristas_chamados")
        .select("id, created_at, avaria_id, motorista_chapa, motorista_nome, data_chamado, data_evidencia, evidencias_urls")
        .eq("avaria_id", avariaId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const mapped = (data || []).map((r) => ({
        __tempId: null,
        id: r.id,
        motorista: { chapa: r.motorista_chapa || "", nome: r.motorista_nome || "" },
        data_chamado: r.data_chamado || "",
        data_evidencia: r.data_evidencia || "",
        evidencias_urls: safeArray(r.evidencias_urls),
      }));

      setRows(mapped.length ? mapped : [blankRow()]);
    } catch (e) {
      console.error(e);
      alert("❌ Erro ao carregar chamados: " + (e?.message || e));
      setRows([blankRow()]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [avariaId]);

  const hasAnyUnsaved = useMemo(() => rows.some((r) => !r.id), [rows]);

  const setRowPatch = (rowKey, patch) => {
    setRows((prev) =>
      prev.map((r) => {
        const key = r.id || r.__tempId;
        if (key !== rowKey) return r;
        return { ...r, ...patch };
      })
    );
  };

  const addRow = () => setRows((prev) => [...prev, blankRow()]);

  const removeRow = async (r) => {
    const key = r.id || r.__tempId;
    const ok = window.confirm("Remover este chamado?");
    if (!ok) return;

    if (r.id) {
      const { error } = await supabase.from("avarias_motoristas_chamados").delete().eq("id", r.id);
      if (error) {
        alert("❌ Erro ao remover: " + error.message);
        return;
      }
    }

    setRows((prev) => prev.filter((x) => (x.id || x.__tempId) !== key));
  };

  const salvarLinha = async (r) => {
    const key = r.id || r.__tempId;
    const chapa = String(r.motorista?.chapa || "").trim();
    const nome = String(r.motorista?.nome || "").trim();

    if (!chapa) {
      alert("⚠️ Selecione o motorista (chapa) antes de salvar.");
      return;
    }

    if (!r.data_chamado) {
      alert("⚠️ Preencha a data do chamado.");
      return;
    }

    setSavingId(key);

    try {
      const payload = {
        avaria_id: avariaId, // bigint
        motorista_chapa: chapa,
        motorista_nome: nome || null,
        data_chamado: r.data_chamado,
        data_evidencia: r.data_evidencia || null,
        evidencias_urls: Array.isArray(r.evidencias_urls) ? r.evidencias_urls : [],
      };

      if (!r.id) {
        const { data, error } = await supabase
          .from("avarias_motoristas_chamados")
          .insert(payload)
          .select("id, created_at, avaria_id, motorista_chapa, motorista_nome, data_chamado, data_evidencia, evidencias_urls")
          .single();

        if (error) throw error;

        setRows((prev) =>
          prev.map((x) => {
            const k = x.id || x.__tempId;
            if (k !== key) return x;
            return {
              __tempId: null,
              id: data.id,
              motorista: { chapa: data.motorista_chapa || "", nome: data.motorista_nome || "" },
              data_chamado: data.data_chamado || "",
              data_evidencia: data.data_evidencia || "",
              evidencias_urls: safeArray(data.evidencias_urls),
            };
          })
        );
      } else {
        const { error } = await supabase.from("avarias_motoristas_chamados").update(payload).eq("id", r.id);
        if (error) throw error;
        // mantém no estado (já está atualizado)
      }
    } catch (e) {
      console.error(e);
      alert("❌ Erro ao salvar linha: " + (e?.message || e));
    } finally {
      setSavingId(null);
    }
  };

  const uploadEvidencias = async (r, files) => {
    if (!files || files.length === 0) return;

    if (!r.id) {
      alert("⚠️ Salve a linha primeiro antes de anexar evidências.");
      return;
    }

    const chapa = String(r.motorista?.chapa || "").trim();
    if (!chapa) {
      alert("⚠️ Selecione o motorista antes de anexar evidências.");
      return;
    }

    const key = r.id;
    setUploadingId(key);

    try {
      const bucket = "avarias-chamados";
      const novosLinks = [];

      for (const file of files) {
        const path = buildStoragePath(avariaId, chapa, file.name);

        const { error: upErr } = await supabase.storage.from(bucket).upload(path, file);
        if (upErr) {
          alert("❌ Erro upload: " + upErr.message);
          continue;
        }

        const { data: pub } = supabase.storage.from(bucket).getPublicUrl(path);
        if (pub?.publicUrl) novosLinks.push(pub.publicUrl);
      }

      if (novosLinks.length === 0) return;

      const merged = [...safeArray(r.evidencias_urls), ...novosLinks];

      const { error: up2 } = await supabase
        .from("avarias_motoristas_chamados")
        .update({
          evidencias_urls: merged,
          data_evidencia: r.data_evidencia || todayISO(),
        })
        .eq("id", r.id);

      if (up2) throw up2;

      setRowPatch(r.id, {
        evidencias_urls: merged,
        data_evidencia: r.data_evidencia || todayISO(),
      });
    } catch (e) {
      console.error(e);
      alert("❌ Erro ao anexar evidências: " + (e?.message || e));
    } finally {
      setUploadingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-60 p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-6xl w-full max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-4 border-b">
          <div>
            <h2 className="text-xl font-bold text-gray-800">👥 Chamados de Motoristas</h2>
            <p className="text-xs text-gray-500">Vinculado à avaria #{String(avariaId)}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800" aria-label="Fechar">
            <FaTimes size={18} />
          </button>
        </div>

        <div className="p-4 overflow-y-auto">
          {loading ? (
            <div className="text-gray-500 p-6">Carregando...</div>
          ) : (
            <div className="space-y-4">
              {rows.map((r, idx) => {
                const rowKey = r.id || r.__tempId;
                const isSaving = savingId === rowKey;
                const isUploading = uploadingId === r.id;

                return (
                  <div key={rowKey} className="border rounded-lg p-4 bg-gray-50">
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-sm font-semibold text-gray-700">
                        Linha {idx + 1} {r.id ? <span className="text-xs text-gray-500">• Salva</span> : <span className="text-xs text-orange-600">• Rascunho</span>}
                      </div>
                      <button
                        onClick={() => removeRow(r)}
                        className="text-sm px-3 py-1 rounded-md bg-red-600 hover:bg-red-700 text-white"
                      >
                        Remover
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                      <div className="md:col-span-5">
                        <CampoMotorista
                          label="Motorista"
                          value={r.motorista}
                          onChange={(v) => setRowPatch(rowKey, { motorista: v })}
                          disabled={false}
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label className="text-xs font-medium text-gray-600 block mb-1">Data do chamado</label>
                        <input
                          type="date"
                          value={r.data_chamado || ""}
                          onChange={(e) => setRowPatch(rowKey, { data_chamado: e.target.value })}
                          className="border rounded p-2 w-full"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label className="text-xs font-medium text-gray-600 block mb-1">Data da evidência</label>
                        <input
                          type="date"
                          value={r.data_evidencia || ""}
                          onChange={(e) => setRowPatch(rowKey, { data_evidencia: e.target.value })}
                          className="border rounded p-2 w-full"
                        />
                      </div>

                      <div className="md:col-span-3">
                        <label className="text-xs font-medium text-gray-600 block mb-1">Evidência do motorista</label>
                        <input
                          type="file"
                          multiple
                          onChange={(e) => {
                            const files = e.target.files ? Array.from(e.target.files) : [];
                            uploadEvidencias(r, files);
                            e.target.value = "";
                          }}
                          disabled={!r.id || isUploading}
                          className="block text-sm"
                        />
                        {!r.id && <p className="text-[11px] text-gray-500 mt-1">Salve a linha para liberar upload.</p>}
                      </div>
                    </div>

                    {safeArray(r.evidencias_urls).length > 0 && (
                      <div className="mt-3">
                        <div className="text-xs font-semibold text-gray-600 mb-2">Anexos</div>
                        <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
                          {safeArray(r.evidencias_urls).map((url, i) => (
                            <a
                              key={i}
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="border rounded overflow-hidden bg-white hover:opacity-80"
                              title="Abrir"
                            >
                              {url.match(/\.(mp4|mov|webm)$/i) ? (
                                <video controls src={url} className="w-full h-20 object-cover" />
                              ) : url.match(/\.(jpe?g|png|gif|webp|bmp)$/i) ? (
                                <img src={url} alt={`Evidência ${i + 1}`} className="w-full h-20 object-cover" />
                              ) : url.match(/\.pdf$/i) ? (
                                <div className="w-full h-20 flex flex-col items-center justify-center text-xs p-2">
                                  <span className="text-2xl">📄</span>
                                  <span>PDF</span>
                                </div>
                              ) : (
                                <div className="w-full h-20 flex flex-col items-center justify-center text-xs p-2">
                                  <span className="text-2xl">📎</span>
                                  <span>Arquivo</span>
                                </div>
                              )}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="mt-3 flex justify-end gap-2">
                      <button
                        onClick={() => salvarLinha(r)}
                        disabled={isSaving}
                        className={`px-4 py-2 rounded-md text-white ${
                          isSaving ? "bg-gray-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"
                        }`}
                      >
                        {isSaving ? "⏳ Salvando..." : "💾 Salvar linha"}
                      </button>
                    </div>
                  </div>
                );
              })}

              <div className="flex justify-between items-center">
                <button
                  onClick={addRow}
                  className="px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  ➕ Adicionar motorista
                </button>

                <div className="text-xs text-gray-500">
                  {hasAnyUnsaved ? "Há linhas em rascunho (não salvas)." : "Tudo salvo."}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t bg-gray-50 flex justify-end gap-2">
          <button
            onClick={load}
            className="px-4 py-2 rounded-md bg-gray-200 hover:bg-gray-300 text-gray-700"
          >
            🔄 Recarregar
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md bg-gray-500 hover:bg-gray-600 text-white"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
