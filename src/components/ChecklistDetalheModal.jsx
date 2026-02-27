// src/components/ChecklistDetalheModal.jsx
import { useEffect, useMemo, useState } from "react";

function norm(s) {
  return String(s || "").trim();
}

function parseFileUrls(fileurls) {
  if (!fileurls) return [];
  if (Array.isArray(fileurls)) return fileurls.filter(Boolean);

  const raw = String(fileurls).trim();
  if (!raw) return [];

  // tenta JSON: ["url1","url2"]
  if (raw.startsWith("[") && raw.endsWith("]")) {
    try {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return arr.map(String).map((x) => x.trim()).filter(Boolean);
    } catch (_) {}
  }

  // split: url1,url2 ou com quebra de linha
  return raw
    .split(/[\n,;\s]+/g)
    .map((x) => x.trim())
    .filter(Boolean)
    .filter((x) => x.startsWith("http"));
}

function Badge({ children, className = "" }) {
  return <span className={`px-2 py-1 rounded text-xs font-medium ${className}`}>{children}</span>;
}

function TabButton({ active, onClick, children, disabled = false }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={[
        "px-3 py-2 rounded-md text-sm border transition",
        disabled ? "opacity-50 cursor-not-allowed" : "hover:bg-gray-50",
        active ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 border-gray-300",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

export default function ChecklistDetalheModal({ open, onClose, row }) {
  const fotos = useMemo(() => parseFileUrls(row?.fileurls), [row]);
  const temVideo = !!norm(row?.video_url);

  // ✅ abas: resumo | fotos | video
  const [tab, setTab] = useState("resumo");

  // reseta aba quando abrir
  useEffect(() => {
    if (open) setTab("resumo");
  }, [open]);

  if (!open) return null;

  const dataBR = row?.created_at ? new Date(row.created_at).toLocaleDateString("pt-BR") : "-";
  const horaBR = row?.created_at
    ? new Date(row.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : "-";

  const prefixo = row?.numero_veiculo || "-";
  const motorista = row?.nome_motorista || "-";
  const chapa = row?.chapa_motorista ? `(${row.chapa_motorista})` : "";

  // ✅ Descrição completa (a ideia é sempre “em cima”)
  // Preferi: Resposta (geralmente vem completa) e se não tiver, cai no resumo.
  const descricaoCompleta = norm(row?.resposta_texto) || norm(row?.resumo_texto) || "-";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/50">
      {/* ✅ Modal menor + altura controlada */}
      <div className="bg-white w-full max-w-4xl rounded-xl shadow-xl overflow-hidden max-h-[85vh] flex flex-col">
        {/* ✅ HEADER FIXO */}
        <div className="p-4 border-b bg-white flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-lg font-bold text-gray-800 truncate">Detalhes do Checklist</div>

            <div className="text-sm text-gray-600 mt-1">
              <b>Data:</b> {dataBR} &nbsp; | &nbsp; <b>Hora:</b> {horaBR} &nbsp; | &nbsp;{" "}
              <b>Prefixo:</b> {prefixo}
            </div>

            <div className="text-sm text-gray-600">
              <b>Motorista:</b> {motorista} {chapa}
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              {temVideo ? (
                <Badge className="bg-blue-100 text-blue-800">🎥 Vídeo</Badge>
              ) : (
                <Badge className="bg-gray-100 text-gray-700">🎥 Sem vídeo</Badge>
              )}

              {fotos.length > 0 ? (
                <Badge className="bg-green-100 text-green-800">🖼️ {fotos.length} foto(s)</Badge>
              ) : (
                <Badge className="bg-gray-100 text-gray-700">🖼️ Sem fotos</Badge>
              )}

              {row?.link_atendimento ? (
                <a
                  className="text-xs text-blue-700 underline"
                  href={row.link_atendimento}
                  target="_blank"
                  rel="noreferrer"
                >
                  Abrir atendimento
                </a>
              ) : null}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2 rounded-md border bg-white hover:bg-gray-50 text-gray-700"
          >
            Fechar
          </button>
        </div>

        {/* ✅ BODY SCROLL (o modal não fica gigante) */}
        <div className="flex-1 overflow-y-auto">
          {/* ✅ DESCRIÇÃO COMPLETA SEMPRE NO TOPO */}
          <div className="p-4 border-b bg-gray-50">
            <div className="text-xs uppercase tracking-wide text-gray-500">Descrição completa</div>
            <div className="mt-2 text-sm text-gray-800 whitespace-pre-wrap">{descricaoCompleta}</div>
          </div>

          {/* ✅ ABAS */}
          <div className="p-4 border-b bg-white">
            <div className="flex flex-wrap gap-2">
              <TabButton active={tab === "resumo"} onClick={() => setTab("resumo")}>
                Resumo
              </TabButton>

              <TabButton
                active={tab === "fotos"}
                onClick={() => setTab("fotos")}
                disabled={fotos.length === 0}
              >
                Ver fotos
              </TabButton>

              <TabButton active={tab === "video"} onClick={() => setTab("video")} disabled={!temVideo}>
                Ver vídeo
              </TabButton>
            </div>

            <div className="mt-2 text-xs text-gray-500">
              O conteúdo abaixo muda conforme a aba. O topo sempre mantém a descrição.
            </div>
          </div>

          {/* ✅ CONTEÚDO POR ABA */}
          <div className="p-4">
            {tab === "resumo" && (
              <div className="rounded-lg border p-3 bg-white">
                <div className="font-semibold text-gray-800">Resumo do checklist</div>

                <div className="mt-3 space-y-3">
                  <div>
                    <div className="text-xs uppercase tracking-wide text-gray-500">Resumo</div>
                    <div className="text-sm text-gray-800 whitespace-pre-wrap">
                      {row?.resumo_texto || "-"}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs uppercase tracking-wide text-gray-500">Resposta</div>
                    <div className="text-sm text-gray-800 whitespace-pre-wrap">
                      {row?.resposta_texto || "-"}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {tab === "fotos" && (
              <div className="rounded-lg border p-3 bg-white">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-gray-800">Fotos</div>
                  <Badge className="bg-green-100 text-green-800">{fotos.length} foto(s)</Badge>
                </div>

                <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2">
                  {fotos.map((url, idx) => (
                    <a
                      key={`${url}-${idx}`}
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="block border rounded-lg overflow-hidden hover:opacity-90"
                      title="Abrir imagem"
                    >
                      <img
                        src={url}
                        alt={`Foto ${idx + 1}`}
                        className="w-full h-28 object-cover"
                        loading="lazy"
                      />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {tab === "video" && (
              <div className="rounded-lg border p-3 bg-white">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-gray-800">Vídeo</div>
                  <Badge className="bg-blue-100 text-blue-800">Disponível</Badge>
                </div>

                <div className="mt-3">
                  <video src={row.video_url} controls className="w-full rounded-lg bg-black" />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ✅ FOOTER FIXO */}
        <div className="p-4 border-t bg-white flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
