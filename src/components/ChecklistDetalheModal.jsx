// src/components/ChecklistDetalheModal.jsx
import { useEffect, useMemo, useState } from "react";
import {
  FaCar,
  FaUser,
  FaCalendarAlt,
  FaClock,
  FaIdBadge,
  FaCheckCircle,
  FaTimesCircle,
  FaImage,
  FaVideo,
  FaExternalLinkAlt,
  FaTimes,
  FaExclamationTriangle,
  FaInfoCircle,
  FaChevronDown,
  FaChevronRight,
  FaFilePdf,
  FaPrint,
} from "react-icons/fa";
import FileViewerModal from "./FileViewerModal";

function norm(s) {
  return String(s || "").trim();
}

function parseFileUrls(fileurls) {
  if (!fileurls) return [];
  if (Array.isArray(fileurls)) return fileurls.filter(Boolean);
  const raw = String(fileurls).trim();
  if (!raw) return [];
  if (raw.startsWith("[") && raw.endsWith("]")) {
    try {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return arr.map(String).map((x) => x.trim()).filter(Boolean);
    } catch (_) {}
  }
  return raw
    .split(/[\n,;\s]+/g)
    .map((x) => x.trim())
    .filter(Boolean)
    .filter((x) => x.startsWith("http"));
}

function fileNameFromUrl(url) {
  try {
    const raw = String(url || "");
    const noHash = raw.split("#")[0];
    const noQuery = noHash.split("?")[0];
    return decodeURIComponent(noQuery.split("/").filter(Boolean).pop() || "foto-checklist");
  } catch {
    return "foto-checklist";
  }
}

/**
 * Faz o parse do "resumo_texto" do checklist em secoes estruturadas.
 * Suporta padroes do tipo:
 *   "Parte externa - Itens NC:\n• Pneus\n• Farois"
 *   "Parte interna - Itens OK:\n• Documento\n• Cinto"
 *   "Obs. parte externa: Ponteiras arranhada"
 *   "Avarias: Laterais arranhada"
 */
function parseResumo(texto) {
  if (!texto) return { grupos: [], observacoes: [], avarias: "", respostasRaw: "" };

  // Separa o bloco "*Respostas*" se existir (vamos manter raw separado, escondido por padrao)
  const respostasMatch = texto.split(/(?=\*Respostas\*|\bRespostas\b\s*\n)/i);
  const corpo = respostasMatch[0] || texto;
  const respostasRaw = respostasMatch.slice(1).join("\n").trim();

  const linhas = corpo.split(/\r?\n/);
  const grupos = new Map(); // chave: "Parte externa", "Parte interna", "Telemetria"...
  const observacoes = [];
  let avarias = "";

  let secaoAtual = null; // { grupo, tipo: 'NC' | 'OK' }

  for (const linhaRaw of linhas) {
    const linha = linhaRaw.trim();
    if (!linha) continue;

    // "Parte externa - Itens NC:" ou similar
    const cabecalho = linha.match(/^(.+?)\s*-\s*Itens\s+(NC|OK)\s*:/i);
    if (cabecalho) {
      const grupo = cabecalho[1].trim();
      const tipo = cabecalho[2].toUpperCase();
      if (!grupos.has(grupo)) grupos.set(grupo, { NC: [], OK: [] });
      secaoAtual = { grupo, tipo };
      continue;
    }

    // "Obs. parte externa: Ponteiras arranhada"
    const obsMatch = linha.match(/^(?:Obs\.?|Observa[cç][oõ]es?)\s*(.*?):\s*(.*)$/i);
    if (obsMatch) {
      const label = obsMatch[1] ? obsMatch[1].trim() : "Geral";
      const valor = obsMatch[2].trim();
      if (valor) observacoes.push({ label: label || "Observacao", valor });
      secaoAtual = null;
      continue;
    }

    // "Avarias: ..."
    const avariasMatch = linha.match(/^Avarias\s*:\s*(.*)$/i);
    if (avariasMatch) {
      avarias = avariasMatch[1].trim();
      secaoAtual = null;
      continue;
    }

    // "Resposta:" "Enviada"
    if (/^Resposta\s*:?$/i.test(linha) || /^Resumo\s*:?$/i.test(linha)) continue;
    if (/^Enviada\b/i.test(linha)) continue;

    // Bullet: "• Pneus" ou "- Pneus" ou "* Pneus"
    const bullet = linha.match(/^[•*\-–]\s*(.+)$/);
    if (bullet && secaoAtual) {
      const item = bullet[1].trim();
      const negativo = /^Nenhum item marcado/i.test(item);
      if (!negativo) {
        grupos.get(secaoAtual.grupo)[secaoAtual.tipo].push(item);
      }
      continue;
    }

    // Linha sem bullet dentro de uma secao -- adiciona como item
    if (secaoAtual && !linha.includes(":") && linha.length < 80) {
      const negativo = /^Nenhum item marcado/i.test(linha);
      if (!negativo) grupos.get(secaoAtual.grupo)[secaoAtual.tipo].push(linha);
    }
  }

  const gruposArr = Array.from(grupos.entries()).map(([nome, itens]) => ({ nome, ...itens }));
  return { grupos: gruposArr, observacoes, avarias, respostasRaw };
}

function Badge({ children, tone = "slate" }) {
  const tones = {
    slate: "bg-slate-100 text-slate-700 border-slate-200",
    blue: "bg-blue-100 text-blue-800 border-blue-200",
    green: "bg-emerald-100 text-emerald-800 border-emerald-200",
    rose: "bg-rose-100 text-rose-800 border-rose-200",
    amber: "bg-amber-100 text-amber-800 border-amber-200",
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${tones[tone]}`}>
      {children}
    </span>
  );
}

function GrupoCard({ grupo }) {
  const totalNC = grupo.NC.length;
  const totalOK = grupo.OK.length;
  const temNC = totalNC > 0;
  return (
    <div className={`rounded-2xl border ${temNC ? "border-rose-200 bg-rose-50/30" : "border-slate-200 bg-white"} p-3 shadow-sm`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-black uppercase tracking-wide text-slate-800">{grupo.nome}</div>
        <div className="flex gap-2">
          <Badge tone="rose">{totalNC} NC</Badge>
          <Badge tone="green">{totalOK} OK</Badge>
        </div>
      </div>

      {temNC ? (
        <div className="mt-3">
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-rose-700">Nao conformidades</div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {grupo.NC.map((item, idx) => (
              <span key={`nc-${idx}`} className="inline-flex items-center gap-1 rounded-lg bg-rose-100 px-2 py-1 text-xs font-semibold text-rose-800">
                <FaTimesCircle className="text-rose-600" /> {item}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {totalOK ? (
        <div className="mt-3">
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-700">Itens OK</div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {grupo.OK.map((item, idx) => (
              <span key={`ok-${idx}`} className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-800">
                <FaCheckCircle className="text-emerald-600" /> {item}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {totalNC === 0 && totalOK === 0 ? (
        <div className="mt-2 text-xs text-slate-500">Nenhum item neste grupo.</div>
      ) : null}
    </div>
  );
}

function InfoChip({ icon, label, value }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5">
      <div className="text-slate-400">{icon}</div>
      <div className="min-w-0">
        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">{label}</div>
        <div className="truncate text-sm font-semibold text-slate-800">{value || "-"}</div>
      </div>
    </div>
  );
}

export default function ChecklistDetalheModal({ open, onClose, row }) {
  const fotos = useMemo(() => parseFileUrls(row?.fileurls), [row]);
  const temVideo = !!norm(row?.video_url);

  const parsed = useMemo(() => parseResumo(row?.resumo_texto || row?.resposta_texto || ""), [row]);

  const [tab, setTab] = useState("resumo");
  const [respostasOpen, setRespostasOpen] = useState(false);
  const [viewerFile, setViewerFile] = useState(null);
  const [relatorioOpen, setRelatorioOpen] = useState(false);

  useEffect(() => {
    if (open) {
      setTab("resumo");
      setRespostasOpen(false);
      setViewerFile(null);
      setRelatorioOpen(false);
    }
  }, [open]);

  if (!open) return null;

  const dataBR = row?.created_at ? new Date(row.created_at).toLocaleDateString("pt-BR") : "-";
  const horaBR = row?.created_at
    ? new Date(row.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : "-";

  const prefixo = row?.numero_veiculo || "-";
  const motorista = row?.nome_motorista || "-";
  const chapa = row?.chapa_motorista || "";

  const totalNC = parsed.grupos.reduce((acc, g) => acc + g.NC.length, 0);
  const totalOK = parsed.grupos.reduce((acc, g) => acc + g.OK.length, 0);
  const algumaCoisa = parsed.grupos.length > 0 || parsed.observacoes.length > 0 || parsed.avarias;

  return (
    <>
      <ChecklistRelatorioModal
        open={open}
        onClose={onClose}
        row={row}
        fotos={fotos}
        parsed={parsed}
        prefixo={prefixo}
        motorista={motorista}
        chapa={chapa}
        dataBR={dataBR}
        horaBR={horaBR}
        totalNC={totalNC}
        totalOK={totalOK}
        temVideo={temVideo}
        onOpenFile={setViewerFile}
      />

      <FileViewerModal
        open={Boolean(viewerFile?.url)}
        url={viewerFile?.url || ""}
        name={viewerFile?.name || ""}
        onClose={() => setViewerFile(null)}
      />
    </>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* HEADER */}
        <div className="border-b border-slate-200 bg-gradient-to-br from-blue-700 via-blue-600 to-cyan-700 px-5 py-4 text-white">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-200">Checklists · Detalhe</div>
              <div className="text-xl font-black">Checklist do veiculo {prefixo}</div>
              <div className="mt-1 text-sm text-blue-100">{motorista}{chapa ? ` · Chapa ${chapa}` : ""}</div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => setRelatorioOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm font-black text-blue-700 shadow-sm hover:bg-blue-50"
              >
                <FaFilePdf /> Relatorio / PDF
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl bg-white/15 p-2 text-white hover:bg-white/25"
                aria-label="Fechar"
              >
                <FaTimes />
              </button>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
            <InfoChipDark icon={<FaCalendarAlt />} label="Data" value={dataBR} />
            <InfoChipDark icon={<FaClock />} label="Hora" value={horaBR} />
            <InfoChipDark icon={<FaCar />} label="Prefixo" value={prefixo} />
            <InfoChipDark icon={<FaIdBadge />} label="Chapa" value={chapa || "-"} />
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge tone={totalNC > 0 ? "rose" : "green"}>
              {totalNC > 0 ? `${totalNC} nao conformidade(s)` : "Sem nao conformidades"}
            </Badge>
            <Badge tone="green">{totalOK} item(ns) OK</Badge>
            {temVideo ? <Badge tone="blue"><FaVideo /> Video</Badge> : <Badge tone="slate"><FaVideo /> Sem video</Badge>}
            {fotos.length ? <Badge tone="green"><FaImage /> {fotos.length} foto(s)</Badge> : <Badge tone="slate"><FaImage /> Sem fotos</Badge>}
            {row?.link_atendimento ? (
              <a className="inline-flex items-center gap-1 rounded-full border border-white/30 bg-white/10 px-2.5 py-0.5 text-[11px] font-semibold text-white hover:bg-white/20"
                href={row.link_atendimento} target="_blank" rel="noreferrer">
                <FaExternalLinkAlt /> Abrir atendimento
              </a>
            ) : null}
          </div>
        </div>

        {/* TABS */}
        <div className="flex flex-wrap gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2">
          <TabBtn active={tab === "resumo"} onClick={() => setTab("resumo")}>Resumo</TabBtn>
          <TabBtn active={tab === "fotos"} onClick={() => setTab("fotos")} disabled={!fotos.length}>
            Fotos {fotos.length ? `(${fotos.length})` : ""}
          </TabBtn>
          <TabBtn active={tab === "video"} onClick={() => setTab("video")} disabled={!temVideo}>Video</TabBtn>
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto bg-slate-50 px-4 py-4">
          <div className="mb-4 grid gap-3 md:grid-cols-[1.4fr_1fr_1fr]">
            <div className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-blue-600">
                <FaUser /> Motorista
              </div>
              <div className="mt-2 text-2xl font-black text-slate-900">{motorista}</div>
              {chapa ? <div className="mt-1 text-sm font-bold text-slate-500">Chapa {chapa}</div> : null}
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                <FaCalendarAlt /> Data
              </div>
              <div className="mt-2 text-2xl font-black text-slate-900">{dataBR}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                <FaClock /> Hora
              </div>
              <div className="mt-2 text-2xl font-black text-slate-900">{horaBR}</div>
            </div>
          </div>

          {tab === "resumo" ? (
            <div className="space-y-3">
              {parsed.avarias ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3">
                  <div className="flex items-center gap-2 text-sm font-black uppercase tracking-wide text-amber-800">
                    <FaExclamationTriangle /> Avarias relatadas
                  </div>
                  <div className="mt-1 text-sm text-amber-900">{parsed.avarias}</div>
                </div>
              ) : null}

              {parsed.observacoes.length ? (
                <div className="rounded-2xl border border-blue-200 bg-blue-50/60 p-3">
                  <div className="flex items-center gap-2 text-sm font-black uppercase tracking-wide text-blue-800">
                    <FaInfoCircle /> Observacoes
                  </div>
                  <div className="mt-2 space-y-1.5">
                    {parsed.observacoes.map((o, idx) => (
                      <div key={idx} className="rounded-xl bg-white px-3 py-2 text-sm text-slate-800">
                        <strong className="text-blue-700">{o.label}:</strong> {o.valor}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {parsed.grupos.length ? (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {parsed.grupos.map((g) => <GrupoCard key={g.nome} grupo={g} />)}
                </div>
              ) : null}

              {!algumaCoisa ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
                  Nao foi possivel extrair o resumo estruturado deste checklist.
                </div>
              ) : null}

              {parsed.respostasRaw ? (
                <div className="rounded-2xl border border-slate-200 bg-white">
                  <button
                    type="button"
                    onClick={() => setRespostasOpen((v) => !v)}
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-bold uppercase tracking-wide text-slate-600 hover:bg-slate-50"
                  >
                    <span>Detalhes tecnicos (Respostas)</span>
                    {respostasOpen ? <FaChevronDown /> : <FaChevronRight />}
                  </button>
                  {respostasOpen ? (
                    <pre className="max-h-60 overflow-auto whitespace-pre-wrap border-t border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
                      {parsed.respostasRaw}
                    </pre>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          {tab === "fotos" ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-3">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-sm font-black uppercase tracking-wide text-slate-700">Fotos do checklist</div>
                <Badge tone="green">{fotos.length} foto(s)</Badge>
              </div>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {fotos.map((url, idx) => (
                  <button
                    key={`${url}-${idx}`}
                    type="button"
                    onClick={() => setViewerFile({ url, name: fileNameFromUrl(url) })}
                    className="group overflow-hidden rounded-xl border border-slate-200 bg-white text-left shadow-sm hover:border-blue-300"
                    title="Abrir foto"
                  >
                    <img src={url} alt={`Foto ${idx + 1}`} className="h-36 w-full object-cover transition group-hover:scale-[1.02]" loading="lazy" />
                    <div className="flex items-center justify-between px-3 py-2 text-xs font-bold text-slate-700">
                      <span>Foto {idx + 1}</span>
                      <FaExternalLinkAlt className="text-blue-600" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {tab === "video" ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-3">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-sm font-black uppercase tracking-wide text-slate-700">Video do checklist</div>
                <Badge tone="blue">Disponivel</Badge>
              </div>
              <video src={row.video_url} controls className="w-full rounded-xl bg-black" />
            </div>
          ) : null}

        </div>

        {/* FOOTER */}
        <div className="flex items-center justify-end border-t border-slate-200 bg-white px-4 py-3">
          <button
            type="button"
            onClick={() => setRelatorioOpen(true)}
            className="mr-2 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-100 px-5 py-2 text-sm font-bold text-slate-700 hover:bg-slate-200"
          >
            <FaFilePdf /> Relatorio / PDF
          </button>
          <button type="button" onClick={onClose} className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-bold text-white hover:bg-blue-700">
            Fechar
          </button>
        </div>
      </div>

      <ChecklistRelatorioModal
        open={relatorioOpen}
        onClose={() => setRelatorioOpen(false)}
        row={row}
        fotos={fotos}
        parsed={parsed}
        prefixo={prefixo}
        motorista={motorista}
        chapa={chapa}
        dataBR={dataBR}
        horaBR={horaBR}
        totalNC={totalNC}
        totalOK={totalOK}
        temVideo={temVideo}
      />

      <FileViewerModal
        open={Boolean(viewerFile?.url)}
        url={viewerFile?.url || ""}
        name={viewerFile?.name || ""}
        onClose={() => setViewerFile(null)}
      />
    </div>
  );
}

function ChecklistRelatorioModal({
  open,
  onClose,
  row,
  fotos,
  parsed,
  prefixo,
  motorista,
  chapa,
  dataBR,
  horaBR,
  totalNC,
  totalOK,
  temVideo,
  onOpenFile,
}) {
  const [salvandoPDF, setSalvandoPDF] = useState(false);

  async function salvarPDF() {
    const element = document.getElementById("checklist-report-page-content");
    if (!element) return;

    setSalvandoPDF(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");
      const canvas = await html2canvas(element, {
        backgroundColor: "#ffffff",
        scale: 2,
        useCORS: true,
        windowWidth: element.scrollWidth,
        windowHeight: element.scrollHeight,
      });

      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 8;
      const imgWidth = pageWidth - margin * 2;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      const pageBodyHeight = pageHeight - margin * 2;
      const imgData = canvas.toDataURL("image/jpeg", 0.95);

      let heightLeft = imgHeight;
      let position = margin;
      pdf.addImage(imgData, "JPEG", margin, position, imgWidth, imgHeight);
      heightLeft -= pageBodyHeight;

      while (heightLeft > 0) {
        position = margin - (imgHeight - heightLeft);
        pdf.addPage();
        pdf.addImage(imgData, "JPEG", margin, position, imgWidth, imgHeight);
        heightLeft -= pageBodyHeight;
      }

      const dataArquivo = String(dataBR || "").replace(/\D/g, "") || "checklist";
      const prefixoArquivo = String(prefixo || "veiculo").replace(/[^\w-]+/g, "-");
      pdf.save(`checklist-${prefixoArquivo}-${dataArquivo}.pdf`);
    } catch (error) {
      console.error("Erro ao salvar PDF do checklist:", error);
      alert("Nao foi possivel salvar o PDF automaticamente. Use o botao Imprimir e escolha Salvar como PDF.");
    } finally {
      setSalvandoPDF(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-sm">
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #checklist-report-print, #checklist-report-print * { visibility: visible !important; }
          #checklist-report-print {
            position: absolute !important;
            inset: 0 auto auto 0 !important;
            width: 100% !important;
            max-width: none !important;
            border: 0 !important;
            box-shadow: none !important;
          }
          .checklist-report-actions { display: none !important; }
          .checklist-report-page { padding: 14mm !important; }
          .checklist-report-photo { break-inside: avoid; page-break-inside: avoid; }
        }
      `}</style>

      <div id="checklist-report-print" className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="checklist-report-actions flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.24em] text-blue-600">Relatorio do Checklist</div>
            <div className="mt-1 text-lg font-black text-slate-900">Veiculo {prefixo} - {motorista}</div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 hover:bg-slate-50"
            >
              <FaPrint /> Imprimir
            </button>
            <button
              type="button"
              onClick={salvarPDF}
              disabled={salvandoPDF}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-black text-white hover:bg-blue-700 disabled:cursor-wait disabled:bg-blue-400"
            >
              <FaFilePdf /> {salvandoPDF ? "Gerando..." : "Salvar PDF"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-200"
            >
              <FaTimes /> Fechar
            </button>
          </div>
        </div>

        <div id="checklist-report-page-content" className="checklist-report-page flex-1 overflow-y-auto bg-white p-6 text-slate-900">
          <div className="border-b-4 border-blue-700 pb-5">
            <div className="text-xs font-black uppercase tracking-[0.24em] text-blue-700">Checklist completo</div>
            <div className="mt-2 text-4xl font-black">Veiculo {prefixo}</div>
            <div className="mt-4 grid gap-3 md:grid-cols-[1.5fr_1fr_1fr]">
              <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-700">Motorista</div>
                <div className="mt-1 text-2xl font-black text-slate-950">{motorista}</div>
                {chapa ? <div className="mt-1 text-base font-bold text-slate-600">Chapa {chapa}</div> : null}
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Data</div>
                <div className="mt-1 text-2xl font-black text-slate-950">{dataBR}</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Hora</div>
                <div className="mt-1 text-2xl font-black text-slate-950">{horaBR}</div>
              </div>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
            <ReportMetric label="Nao conformidades" value={totalNC} tone={totalNC > 0 ? "rose" : "green"} />
            <ReportMetric label="Itens OK" value={totalOK} tone="green" />
            <ReportMetric label="Fotos" value={fotos.length} tone="blue" />
            <ReportMetric label="Video" value={temVideo ? "Sim" : "Nao"} tone={temVideo ? "blue" : "slate"} />
          </div>

          {parsed.avarias ? (
            <section className="mt-5 rounded-xl border border-amber-300 bg-amber-50 p-4">
              <h2 className="text-sm font-black uppercase tracking-wide text-amber-900">Avarias relatadas</h2>
              <p className="mt-2 text-sm text-amber-950">{parsed.avarias}</p>
            </section>
          ) : null}

          {parsed.observacoes.length ? (
            <section className="mt-5">
              <h2 className="text-sm font-black uppercase tracking-wide text-slate-800">Observacoes</h2>
              <div className="mt-2 grid gap-2">
                {parsed.observacoes.map((o, idx) => (
                  <div key={idx} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
                    <strong>{o.label}:</strong> {o.valor}
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {parsed.grupos.length ? (
            <section className="mt-5">
              <h2 className="text-sm font-black uppercase tracking-wide text-slate-800">Itens do checklist</h2>
              <div className="mt-2 grid gap-3 md:grid-cols-2">
                {parsed.grupos.map((grupo) => (
                  <div key={grupo.nome} className="rounded-xl border border-slate-200 p-3">
                    <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
                      <h3 className="text-sm font-black text-slate-900">{grupo.nome}</h3>
                      <span className="text-xs font-bold text-slate-500">{grupo.NC.length} NC · {grupo.OK.length} OK</span>
                    </div>
                    <ReportList title="Nao conformidades" items={grupo.NC} tone="rose" />
                    <ReportList title="Itens OK" items={grupo.OK} tone="green" />
                  </div>
                ))}
              </div>
            </section>
          ) : (
            <section className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              Resumo estruturado nao disponivel para este checklist.
            </section>
          )}

          {fotos.length ? (
            <section className="mt-6">
              <h2 className="text-sm font-black uppercase tracking-wide text-slate-800">Fotos do checklist</h2>
              <div className="mt-3 grid gap-4 md:grid-cols-2">
                {fotos.map((url, idx) => (
                  <figure key={`${url}-${idx}`} className="checklist-report-photo overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                    <button
                      type="button"
                      onClick={() => onOpenFile?.({ url, name: fileNameFromUrl(url) })}
                      className="block w-full bg-white"
                      title="Abrir foto"
                    >
                      <img src={url} alt={`Foto ${idx + 1}`} className="max-h-[360px] w-full object-contain" />
                    </button>
                    <figcaption className="border-t border-slate-200 px-3 py-2 text-xs font-bold text-slate-600">
                      Foto {idx + 1}
                    </figcaption>
                  </figure>
                ))}
              </div>
            </section>
          ) : null}

          {temVideo ? (
            <section className="mt-6 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm">
              <h2 className="text-sm font-black uppercase tracking-wide text-blue-900">Video</h2>
              <a href={row.video_url} target="_blank" rel="noreferrer" className="mt-2 inline-block break-all font-bold text-blue-700">
                {row.video_url}
              </a>
            </section>
          ) : null}

        </div>
      </div>
    </div>
  );
}

function ReportMetric({ label, value, tone = "slate" }) {
  const tones = {
    slate: "border-slate-200 bg-slate-50 text-slate-800",
    blue: "border-blue-200 bg-blue-50 text-blue-800",
    green: "border-emerald-200 bg-emerald-50 text-emerald-800",
    rose: "border-rose-200 bg-rose-50 text-rose-800",
  };
  return (
    <div className={`rounded-xl border p-3 ${tones[tone]}`}>
      <div className="text-[10px] font-black uppercase tracking-[0.18em] opacity-75">{label}</div>
      <div className="mt-1 text-2xl font-black">{value}</div>
    </div>
  );
}

function ReportList({ title, items, tone }) {
  const color = tone === "rose" ? "text-rose-800" : "text-emerald-800";
  if (!items.length) return null;
  return (
    <div className="mt-3">
      <div className={`text-xs font-black uppercase tracking-wide ${color}`}>{title}</div>
      <ul className="mt-1 list-inside list-disc space-y-1 text-sm text-slate-800">
        {items.map((item, idx) => (
          <li key={`${item}-${idx}`}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function InfoChipDark({ icon, label, value }) {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-white/15 px-3 py-1.5">
      <div className="text-blue-200">{icon}</div>
      <div className="min-w-0">
        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-200">{label}</div>
        <div className="truncate text-sm font-bold text-white">{value || "-"}</div>
      </div>
    </div>
  );
}

function TabBtn({ active, disabled, onClick, children }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded-xl border px-3 py-1.5 text-sm font-bold transition ${
        disabled
          ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
          : active
          ? "border-blue-600 bg-blue-600 text-white"
          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
      }`}
    >
      {children}
    </button>
  );
}
