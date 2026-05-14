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
} from "react-icons/fa";

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

  useEffect(() => {
    if (open) {
      setTab("resumo");
      setRespostasOpen(false);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* HEADER */}
        <div className="border-b border-slate-200 bg-gradient-to-br from-blue-600 to-blue-800 px-5 py-4 text-white">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-200">Checklists · Detalhe</div>
              <div className="text-xl font-black">Checklist do veiculo {prefixo}</div>
              <div className="mt-1 text-sm text-blue-100">{motorista}{chapa ? ` · Chapa ${chapa}` : ""}</div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl bg-white/15 p-2 text-white hover:bg-white/25"
              aria-label="Fechar"
            >
              <FaTimes />
            </button>
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
          <TabBtn active={tab === "raw"} onClick={() => setTab("raw")}>Texto bruto</TabBtn>
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto bg-slate-50 px-4 py-4">
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
                  Nao foi possivel extrair o resumo estruturado. Veja a aba "Texto bruto" para o conteudo original.
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
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                {fotos.map((url, idx) => (
                  <a key={`${url}-${idx}`} href={url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl border border-slate-200 hover:opacity-90" title="Abrir imagem">
                    <img src={url} alt={`Foto ${idx + 1}`} className="h-32 w-full object-cover" loading="lazy" />
                  </a>
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

          {tab === "raw" ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-3">
              <div className="mb-2 text-sm font-black uppercase tracking-wide text-slate-700">Texto bruto</div>
              <pre className="whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-xs text-slate-700">
                {row?.resumo_texto || row?.resposta_texto || "-"}
              </pre>
            </div>
          ) : null}
        </div>

        {/* FOOTER */}
        <div className="flex items-center justify-end border-t border-slate-200 bg-white px-4 py-3">
          <button type="button" onClick={onClose} className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-bold text-white hover:bg-blue-700">
            Fechar
          </button>
        </div>
      </div>
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
