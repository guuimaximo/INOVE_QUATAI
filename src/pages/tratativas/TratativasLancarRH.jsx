// src/pages/TratativasLancarRH.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../supabase";

/* =========================
   Helpers
========================= */
function brDateTime(d) {
  if (!d) return "—";
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleString("pt-BR");
}

function brDate(d) {
  if (!d) return "—";
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString("pt-BR");
}

function fileNameFromUrl(u) {
  try {
    const raw = String(u || "");
    const noHash = raw.split("#")[0];
    const noQuery = noHash.split("?")[0];
    const last = noQuery.split("/").filter(Boolean).pop() || "arquivo";
    return decodeURIComponent(last);
  } catch {
    return "arquivo";
  }
}

function isImageUrl(u) {
  const s = String(u || "").toLowerCase();
  return /\.(png|jpe?g|gif|webp|bmp|svg)(\?|#|$)/.test(s);
}

function isPdf(u) {
  const s = String(u || "").toLowerCase();
  return s.includes(".pdf") || /\.(pdf)(\?|#|$)/.test(s);
}

function sanitizeName(name) {
  return String(name || "arquivo")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9._-]/g, "");
}

async function uploadToTratativasBucket(file, prefixFolder) {
  const safeName = sanitizeName(file?.name);
  const unique = `${Date.now()}_${Math.random().toString(16).slice(2)}_${safeName}`;
  const path = `${prefixFolder}/${unique}`;

  const up = await supabase.storage.from("tratativas").upload(path, file, {
    upsert: false,
    contentType: file?.type || undefined,
  });
  if (up.error) throw up.error;

  const { data: pub } = supabase.storage.from("tratativas").getPublicUrl(path);
  return pub?.publicUrl || null;
}

function makeFileFromClipboardImage(blobFile) {
  const type = blobFile?.type || "image/png";
  const ext = type === "image/jpeg" ? "jpg" : "png";
  const name = `print_transnet_${new Date().toISOString().replace(/[:.]/g, "-")}.${ext}`;
  return new File([blobFile], name, { type, lastModified: Date.now() });
}

/* =========================
   UI helpers
========================= */

// ✅ “Logo PDF” simples (tile) + nome embaixo
function PdfTile({ name }) {
  return (
    <div className="rounded-lg border bg-white overflow-hidden hover:shadow-sm">
      <div className="h-20 flex items-center justify-center bg-gray-50">
        <div className="h-10 w-10 rounded-lg bg-red-100 text-red-700 flex items-center justify-center text-xs font-bold">
          PDF
        </div>
      </div>
      <div className="px-2 py-1.5 text-xs text-gray-700 truncate">{name}</div>
    </div>
  );
}

function ImgTile({ src, name }) {
  return (
    <div className="rounded-lg border bg-white overflow-hidden hover:shadow-sm">
      <img
        src={src}
        alt={name}
        className="h-20 w-full object-cover"
        loading="lazy"
      />
      <div className="px-2 py-1.5 text-xs text-gray-700 truncate">{name}</div>
    </div>
  );
}

// ✅ Grid de evidências (com PDF tile + nome embaixo)
function EvidenciasGrid({ urls, label }) {
  const arr = Array.isArray(urls) ? urls.filter(Boolean) : [];
  return (
    <div>
      <div className="text-sm text-gray-600 mb-2">{label}</div>

      {arr.length === 0 ? (
        <div className="text-sm text-gray-400">—</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {arr.map((u, i) => {
            const name = fileNameFromUrl(u);
            const pdf = isPdf(u);
            const img = isImageUrl(u) && !pdf;

            return (
              <a
                key={`${u}-${i}`}
                href={u}
                target="_blank"
                rel="noopener noreferrer"
                title="Abrir evidência"
                className="block"
              >
                {img ? <ImgTile src={u} name={name} /> : <PdfTile name={name} />}
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function TratativasLancarRH({ aberto, grupo, onClose, onSaved }) {
  const [loading, setLoading] = useState(false);
  const [obsRH, setObsRH] = useState("");
  const [evidFile, setEvidFile] = useState(null);

  const modalRef = useRef(null);

  // ✅ input ref (forma mais confiável de abrir seletor)
  const fileInputRef = useRef(null);

  const evidenciasTratador = useMemo(() => {
    const arr = Array.from(
      new Set([...(grupo?.evidencia_conclusao_urls || []), ...(grupo?.anexo_tratador_urls || [])])
    );
    return arr.filter(Boolean);
  }, [grupo]);

  // ✅ Preview do arquivo selecionado (objURL)
  const [previewObjUrl, setPreviewObjUrl] = useState(null);
  useEffect(() => {
    if (!evidFile) {
      if (previewObjUrl) URL.revokeObjectURL(previewObjUrl);
      setPreviewObjUrl(null);
      return;
    }
    const url = URL.createObjectURL(evidFile);
    setPreviewObjUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return url;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evidFile]);

  useEffect(() => {
    return () => {
      if (previewObjUrl) URL.revokeObjectURL(previewObjUrl);
    };
  }, [previewObjUrl]);

  // ✅ handler robusto de paste
  const handlePaste = (e) => {
    try {
      const cd = e.clipboardData;
      if (!cd) return;

      const items = cd.items ? Array.from(cd.items) : [];
      const imgItem = items.find((it) => it.kind === "file" && it.type?.startsWith("image/"));

      if (imgItem) {
        e.preventDefault();
        const f = imgItem.getAsFile();
        if (f) setEvidFile(makeFileFromClipboardImage(f));
        return;
      }

      const files = cd.files ? Array.from(cd.files) : [];
      const imgFile = files.find((f) => f.type?.startsWith("image/"));
      if (imgFile) {
        e.preventDefault();
        setEvidFile(makeFileFromClipboardImage(imgFile));
      }
    } catch {
      // noop
    }
  };

  // ✅ listeners enquanto modal aberto
  useEffect(() => {
    if (!aberto) return;

    const onPasteWindow = (e) => handlePaste(e);
    const onPasteDoc = (e) => handlePaste(e);

    window.addEventListener("paste", onPasteWindow);
    document.addEventListener("paste", onPasteDoc);

    return () => {
      window.removeEventListener("paste", onPasteWindow);
      document.removeEventListener("paste", onPasteDoc);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto]);

  useEffect(() => {
    if (aberto) {
      setObsRH("");
      setEvidFile(null);
      setTimeout(() => modalRef.current?.focus?.(), 150);
    }
  }, [aberto]);

  if (!aberto || !grupo) return null;

  async function fecharMedidaRH() {
    if (grupo.rh_lancado) {
      alert("Este lançamento já está concluído no RH.");
      return;
    }

    if (!obsRH?.trim()) {
      alert("Informe a observação do RH (ex.: 'Lançado no Transnet').");
      return;
    }
    if (!evidFile) {
      alert("Cole (Ctrl+V) ou selecione a evidência (print/documento) do Transnet.");
      return;
    }

    setLoading(true);
    try {
      const evidUrl = await uploadToTratativasBucket(
        evidFile,
        `${grupo.tratativa_ids?.[0] || "rh"}/rh_transnet`
      );

      const payload = (grupo.tratativa_ids || []).map((tratativa_id) => ({
        tratativa_id,
        status_rh: "CONCLUIDA",
        lancado_transnet: true,
        lancado_em: new Date().toISOString(),
        observacao_rh: obsRH.trim(),
        evidencia_transnet_url: evidUrl,
        // ✅ CORREÇÃO: Adicionando acao_final obrigatória
        acao_final: grupo.acao_aplicada, 
      }));

      const up = await supabase.from("tratativas_rh").upsert(payload, { onConflict: "tratativa_id" });
      if (up.error) throw up.error;

      alert("RH: medida fechada com sucesso (Transnet lançado).");
      if (onSaved) await onSaved();
    } catch (e) {
      alert(`Erro ao fechar medida: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  // ✅ Preview RH (selecionado): imagem thumb / PDF tile
  const renderPreviewRH = () => {
    if (!evidFile) return <div className="text-sm text-gray-400">—</div>;

    const name = evidFile.name || "arquivo";
    const isPdfFile =
      evidFile.type === "application/pdf" || String(name).toLowerCase().endsWith(".pdf");

    return (
      <div className="flex items-start gap-3">
        <div className="w-32">
          {isPdfFile ? <PdfTile name={name} /> : <ImgTile src={previewObjUrl} name={name} />}
        </div>

        <div className="flex-1">
          <div className="text-xs text-gray-500">Selecionado</div>
          <div className="text-sm text-gray-700 break-words">{name}</div>

          <button
            type="button"
            className="mt-2 text-xs text-red-600 hover:underline"
            onClick={() => setEvidFile(null)}
            disabled={loading}
          >
            Remover
          </button>
        </div>
      </div>
    );
  };

  // ✅ botão confiável para abrir seletor
  const openFileDialog = () => {
    if (loading) return;
    fileInputRef.current?.click?.();
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50"
      onPasteCapture={handlePaste}
    >
      <div
        ref={modalRef}
        tabIndex={-1}
        className="w-full max-w-4xl bg-white rounded-lg shadow-lg overflow-hidden outline-none"
      >
        {/* header */}
        <div className="p-4 border-b flex items-center justify-between">
          <div>
            <div className="text-lg font-bold">Lançar no Transnet (RH)</div>
            <div className="text-xs text-gray-500">
              <span className="font-semibold">{grupo.acao_aplicada}</span> • {grupo.motorista_nome} ({grupo.motorista_chapa})
              {" "}• Arquivo: <span className="font-semibold">{grupo.arquivo_key}</span> • {grupo.qtd_tratativas} tratativa(s)
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-md bg-gray-200 px-4 py-2 text-sm hover:bg-gray-300"
          >
            Fechar
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* tabela azul */}
          <div className="bg-white shadow rounded-lg overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-blue-600 text-white">
                <tr>
                  <th className="py-2 px-3 text-left">Data</th>
                  <th className="py-2 px-3 text-left">Ocorrência</th>
                  <th className="py-2 px-3 text-left">Linha</th>
                  <th className="py-2 px-3 text-left">Prioridade</th>
                  <th className="py-2 px-3 text-left">Setor</th>
                  <th className="py-2 px-3 text-left">Data Ocorrido</th>
                </tr>
              </thead>
              <tbody>
                {(grupo.itens || []).map((i) => (
                  <tr key={`${i.tratativa_id}-${i.detalhe_id}`} className="border-t hover:bg-gray-50">
                    <td className="py-2 px-3 text-gray-700">{brDateTime(i.detalhe_created_at)}</td>
                    <td className="py-2 px-3 text-gray-700">{i.tipo_ocorrencia || "—"}</td>
                    <td className="py-2 px-3 text-gray-700">{i.linha || "—"}</td>
                    <td className="py-2 px-3 text-gray-700">{i.prioridade || "—"}</td>
                    <td className="py-2 px-3 text-gray-700">{i.setor_origem || "—"}</td>
                    <td className="py-2 px-3 text-gray-700">{brDate(i.data_ocorrido)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ✅ miniaturas tratador */}
          <EvidenciasGrid urls={evidenciasTratador} label="Evidências (Tratador) — miniaturas" />

          <hr />

          <div>
            <div className="text-sm font-semibold mb-2">RH (Transnet)</div>

            <label className="block text-sm text-gray-600 mb-1">Observação RH</label>
            <textarea
              rows={3}
              className="w-full rounded-md border px-3 py-2"
              placeholder="Ex.: Lançado no Transnet (print anexado)."
              value={obsRH}
              onChange={(e) => setObsRH(e.target.value)}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
              {/* Arquivo */}
              <div className="space-y-2">
                <div className="text-sm text-gray-600">Evidência (arquivo)</div>

                <div className="rounded-lg border bg-gray-50 p-3">
                  {/* ✅ input real + ref */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,application/pdf"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0] || null;
                      setEvidFile(f);
                      // ✅ permite selecionar o MESMO arquivo novamente depois
                      e.target.value = "";
                    }}
                  />

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openFileDialog();
                    }}
                    className="inline-flex cursor-pointer items-center justify-center rounded-md border bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Escolher arquivo
                  </button>

                  <div className="mt-3">{renderPreviewRH()}</div>
                </div>
              </div>

              {/* Print */}
              <div className="space-y-2">
                <div className="text-sm text-gray-600">Evidência (print)</div>

                <div
                  className={[
                    "rounded-lg border-2 border-dashed p-4 bg-gray-50",
                    loading ? "opacity-60" : "hover:bg-gray-100",
                  ].join(" ")}
                  onClick={() => modalRef.current?.focus?.()}
                  title="Com o modal aberto, pressione Ctrl+V"
                >
                  <div className="text-sm font-medium text-gray-700">Cole aqui o Print do Transnet</div>
                  <div className="mt-1 text-xs text-gray-500">
                    Dica: com o modal aberto, use <b>Ctrl+V</b>.
                  </div>

                  <div className="mt-3">{renderPreviewRH()}</div>
                </div>
              </div>
            </div>

            <div className="text-xs text-gray-500 mt-2">
              Se o Ctrl+V não colar, geralmente é porque a origem não está copiando imagem para a área de transferência.
              Nesse caso, use “Escolher arquivo”.
            </div>
          </div>
        </div>

        <div className="p-4 border-t flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-md bg-gray-200 px-4 py-2 text-sm hover:bg-gray-300"
            disabled={loading}
          >
            Cancelar
          </button>

          <button
            onClick={fecharMedidaRH}
            disabled={loading}
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {loading ? "Salvando..." : "Fechar Medida"}
          </button>
        </div>
      </div>
    </div>
  );
}
