import React, { useEffect, useMemo, useState } from "react";
import { FaTimes, FaPlus, FaTrash, FaUpload, FaRegFilePdf } from "react-icons/fa";
import { supabase } from "../supabase";
import CampoMotorista from "./CampoMotorista";

function isImageUrl(url) {
  return /\.(jpe?g|png|gif|webp|bmp)$/i.test(url || "");
}
function isVideoUrl(url) {
  return /\.(mp4|mov|webm|mkv)$/i.test(url || "");
}
function isPdfUrl(url) {
  return /\.pdf$/i.test(url || "");
}
function extFromName(name) {
  const n = String(name || "");
  if (!n.includes(".")) return "bin";
  return n.split(".").pop().toLowerCase() || "bin";
}
function safeFileName(name) {
  return String(name || "").replace(/[^a-zA-Z0-9.\-_]/g, "");
}

export default function ChamadosMotoristasModal({ avariaId, onClose }) {
  const BUCKET = "avarias-chamados";

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [savingAll, setSavingAll] = useState(false);

  // carrega chamados já salvos no banco
  useEffect(() => {
    if (!avariaId) return;

    const load = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("avarias_motoristas_chamados")
          .select("*")
          .eq("avaria_id", avariaId)
          .order("created_at", { ascending: true });

        if (error) throw error;

        const mapped = (data || []).map((r) => ({
          id: r.id, // já existe no banco
          localId: r.id,
          saved: true,
          motorista: {
            chapa: r.motorista_chapa || "",
            nome: r.motorista_nome || "",
          },
          dataChamado: r.data_chamado ? String(r.data_chamado).slice(0, 10) : "",
          dataEvidencia: r.data_evidencia ? String(r.data_evidencia).slice(0, 10) : "",
          evidencias: Array.isArray(r.evidencias_urls) ? r.evidencias_urls.filter(Boolean) : [],
          uploading: false,
        }));

        setRows(mapped.length ? mapped : [newBlankRow()]);
      } catch (e) {
        console.error(e);
        setRows([newBlankRow()]);
      } finally {
        setLoading(false);
      }
    };

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [avariaId]);

  const newBlankRow = () => ({
    id: null,
    localId: crypto?.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()),
    saved: false,
    motorista: { chapa: "", nome: "" },
    dataChamado: new Date().toISOString().slice(0, 10),
    dataEvidencia: "",
    evidencias: [],
    uploading: false,
  });

  const canEdit = true; // se quiser travar por status, dá pra receber prop e aplicar aqui

  const updateRow = (localId, patch) => {
    setRows((prev) => prev.map((r) => (r.localId === localId ? { ...r, ...patch } : r)));
  };

  const addRow = () => setRows((prev) => [...prev, newBlankRow()]);

  const removeRow = async (localId) => {
    const row = rows.find((r) => r.localId === localId);
    if (!row) return;

    // se já existe no banco, remove do banco
    if (row.saved && row.id) {
      if (!window.confirm("Excluir este chamado do banco?")) return;
      try {
        const { error } = await supabase.from("avarias_motoristas_chamados").delete().eq("id", row.id);
        if (error) throw error;
      } catch (e) {
        console.error(e);
        alert("Erro ao excluir chamado: " + e.message);
        return;
      }
    }

    setRows((prev) => prev.filter((r) => r.localId !== localId));
  };

  // ✅ upload pode acontecer ANTES de salvar a linha
  const handleUploadEvidencia = async (localId, filesList) => {
    const files = Array.from(filesList || []);
    if (!files.length) return;

    const row = rows.find((r) => r.localId === localId);
    if (!row) return;

    updateRow(localId, { uploading: true });

    try {
      const novos = [];

      for (const file of files) {
        const ext = extFromName(file.name);
        const base = safeFileName(file.name || `arquivo.${ext}`);
        const path = `avaria-${avariaId}/chamado-${localId}/${Date.now()}-${Math.random()
          .toString(36)
          .slice(2)}-${base}`;

        const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
          cacheControl: "3600",
          upsert: false,
        });
        if (upErr) throw upErr;

        const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
        if (pub?.publicUrl) novos.push(pub.publicUrl);
      }

      if (novos.length) {
        updateRow(localId, { evidencias: [...(row.evidencias || []), ...novos] });

        // se a linha já está salva no banco, já atualiza o registro (persistência imediata)
        if (row.saved && row.id) {
          const merged = [...(row.evidencias || []), ...novos];
          const { error } = await supabase
            .from("avarias_motoristas_chamados")
            .update({
              evidencias_urls: merged,
              data_evidencia: row.dataEvidencia || null,
            })
            .eq("id", row.id);
          if (error) throw error;
        }
      }
    } catch (e) {
      console.error(e);
      alert("Erro ao enviar evidência: " + e.message);
    } finally {
      updateRow(localId, { uploading: false });
    }
  };

  const removeEvidenciaFromRow = (localId, url) => {
    const row = rows.find((r) => r.localId === localId);
    if (!row) return;

    const filtered = (row.evidencias || []).filter((u) => u !== url);
    updateRow(localId, { evidencias: filtered });

    // se já está salva, atualiza no banco
    if (row.saved && row.id) {
      supabase
        .from("avarias_motoristas_chamados")
        .update({ evidencias_urls: filtered })
        .eq("id", row.id)
        .then(({ error }) => {
          if (error) console.warn("Falha ao atualizar evidências:", error.message);
        });
    }
  };

  const salvarLinha = async (row) => {
    if (!row.motorista?.chapa) {
      alert("Selecione o motorista antes de salvar a linha.");
      return;
    }

    const payload = {
      avaria_id: avariaId,
      motorista_chapa: row.motorista.chapa,
      motorista_nome: row.motorista.nome || null,
      data_chamado: row.dataChamado || null,
      data_evidencia: row.dataEvidencia || null,
      evidencias_urls: Array.isArray(row.evidencias) && row.evidencias.length ? row.evidencias : null,
    };

    // insert ou update
    if (!row.saved) {
      const { data, error } = await supabase
        .from("avarias_motoristas_chamados")
        .insert(payload)
        .select("*")
        .single();
      if (error) throw error;

      updateRow(row.localId, { saved: true, id: data.id, localId: data.id });
      return data.id;
    } else {
      const { error } = await supabase.from("avarias_motoristas_chamados").update(payload).eq("id", row.id);
      if (error) throw error;
      return row.id;
    }
  };

  const salvarTudo = async () => {
    setSavingAll(true);
    try {
      for (const r of rows) {
        // se a linha está “em branco total”, ignora
        const vazio =
          !r.motorista?.chapa &&
          !r.dataChamado &&
          !r.dataEvidencia &&
          (!r.evidencias || r.evidencias.length === 0);
        if (vazio) continue;

        await salvarLinha(r);
      }
      alert("✅ Chamados salvos.");
    } catch (e) {
      console.error(e);
      alert("Erro ao salvar chamados: " + e.message);
    } finally {
      setSavingAll(false);
    }
  };

  const modalTitle = useMemo(() => "👥 Chamados de Motoristas", []);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
      {/* ✅ modal maior */}
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-xl font-bold text-gray-800">{modalTitle}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800" aria-label="Fechar">
            <FaTimes size={18} />
          </button>
        </div>

        <div className="p-4 overflow-y-auto">
          {loading ? (
            <p className="text-sm text-gray-500">Carregando...</p>
          ) : (
            <div className="space-y-4">
              {rows.map((row, idx) => (
                <div key={row.localId} className="border rounded-xl p-4 bg-gray-50">
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-sm font-semibold text-gray-700">
                      Linha #{idx + 1} {row.saved ? <span className="text-green-700">(salva)</span> : null}
                    </div>
                    <button
                      onClick={() => removeRow(row.localId)}
                      className="text-red-600 hover:text-red-700 flex items-center gap-2 text-sm"
                      title="Remover linha"
                    >
                      <FaTrash /> Remover
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3 mt-3">
                    <div className="md:col-span-5">
                      <CampoMotorista
                        label="Motorista"
                        value={row.motorista}
                        onChange={(m) => updateRow(row.localId, { motorista: m })}
                        disabled={!canEdit}
                      />
                    </div>

                    <div className="md:col-span-3">
                      <label className="text-xs font-medium text-gray-600 block">Data do chamado</label>
                      <input
                        type="date"
                        value={row.dataChamado || ""}
                        onChange={(e) => updateRow(row.localId, { dataChamado: e.target.value })}
                        disabled={!canEdit}
                        className="border rounded-md p-2 w-full bg-white disabled:bg-gray-100"
                      />
                    </div>

                    <div className="md:col-span-4">
                      <label className="text-xs font-medium text-gray-600 block">Data da evidência</label>
                      <input
                        type="date"
                        value={row.dataEvidencia || ""}
                        onChange={(e) => updateRow(row.localId, { dataEvidencia: e.target.value })}
                        disabled={!canEdit}
                        className="border rounded-md p-2 w-full bg-white disabled:bg-gray-100"
                      />
                    </div>

                    <div className="md:col-span-12">
                      <label className="text-xs font-medium text-gray-600 block mb-1">Evidências</label>

                      <div className="flex flex-col md:flex-row md:items-center gap-3">
                        {/* ✅ anexa ANTES de salvar linha */}
                        <label className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white text-sm cursor-pointer w-fit">
                          <FaUpload />
                          {row.uploading ? "Enviando..." : "Anexar evidência"}
                          <input
                            type="file"
                            multiple
                            accept="image/*,application/pdf,video/*"
                            className="hidden"
                            onChange={(e) => {
                              handleUploadEvidencia(row.localId, e.target.files);
                              e.target.value = "";
                            }}
                            disabled={!canEdit || row.uploading}
                          />
                        </label>

                        <div className="text-xs text-gray-500">
                          Bucket: <b>{BUCKET}</b> • As fotos aparecem em miniatura.
                        </div>
                      </div>

                      {/* ✅ miniaturas */}
                      {Array.isArray(row.evidencias) && row.evidencias.length > 0 ? (
                        <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                          {row.evidencias.map((url, i) => (
                            <div key={url + i} className="relative group border rounded-lg bg-white overflow-hidden">
                              <a href={url} target="_blank" rel="noopener noreferrer" title="Abrir evidência">
                                {isImageUrl(url) ? (
                                  <img src={url} alt={`Evidência ${i + 1}`} className="w-full h-24 object-cover" />
                                ) : isVideoUrl(url) ? (
                                  <video src={url} className="w-full h-24 object-cover" />
                                ) : isPdfUrl(url) ? (
                                  <div className="w-full h-24 flex flex-col items-center justify-center text-xs text-gray-700">
                                    <FaRegFilePdf className="text-2xl" />
                                    <span className="mt-1">PDF</span>
                                  </div>
                                ) : (
                                  <div className="w-full h-24 flex flex-col items-center justify-center text-xs text-gray-700">
                                    <span className="text-2xl">📎</span>
                                    <span className="mt-1">Arquivo</span>
                                  </div>
                                )}
                              </a>

                              {/* remover do state (e atualiza no banco se já existir) */}
                              <button
                                onClick={() => removeEvidenciaFromRow(row.localId, url)}
                                className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition bg-black/70 text-white rounded px-2 py-1 text-xs"
                                title="Remover evidência desta linha"
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-500 mt-2">Nenhuma evidência anexada nesta linha.</p>
                      )}
                    </div>

                    <div className="md:col-span-12 flex justify-end">
                      <button
                        onClick={async () => {
                          try {
                            await salvarLinha(row);
                            alert("✅ Linha salva.");
                          } catch (e) {
                            console.error(e);
                            alert("Erro ao salvar linha: " + e.message);
                          }
                        }}
                        disabled={!canEdit || row.uploading}
                        className={`px-4 py-2 rounded-md text-white text-sm ${
                          row.uploading ? "bg-gray-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"
                        }`}
                      >
                        💾 Salvar linha
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 pt-2">
                <button
                  onClick={addRow}
                  className="bg-gray-900 hover:bg-gray-800 text-white px-4 py-2 rounded-md flex items-center gap-2 w-fit"
                >
                  <FaPlus /> Adicionar motorista
                </button>

                <button
                  onClick={salvarTudo}
                  disabled={savingAll}
                  className={`px-4 py-2 rounded-md text-white w-fit ${
                    savingAll ? "bg-gray-400 cursor-not-allowed" : "bg-green-600 hover:bg-green-700"
                  }`}
                >
                  {savingAll ? "⏳ Salvando..." : "✅ Salvar todos"}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t bg-gray-50 flex justify-end">
          <button onClick={onClose} className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-md">
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
