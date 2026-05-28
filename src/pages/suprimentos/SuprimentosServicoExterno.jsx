import { useContext, useEffect, useMemo, useRef, useState, useCallback } from "react";
import FileViewerModal from "../../components/FileViewerModal";
import {
  FaBan,
  FaBoxOpen,
  FaCamera,
  FaCheckCircle,
  FaClipboardList,
  FaEdit,
  FaFileAlt,
  FaHistory,
  FaList,
  FaPlus,
  FaPrint,
  FaDownload,
  FaSearch,
  FaTimes,
  FaTimesCircle,
  FaTruck,
  FaTruckLoading,
  FaUndoAlt,
} from "react-icons/fa";
import { AuthContext } from "../../context/AuthContext";
import { supabase } from "../../supabase";
import { EmptyState, KpiCard, PageHero, Panel, PartAutocomplete, StatusChip, SupplierAutocomplete } from "./SuprimentosUI";
import { formatDateBR, formatDateTimeBR, todayISO, uploadSuprimentosFiles } from "./suprimentosShared";
import logoInove from "../../assets/logoInovaQuatai.png";

/* ─── helpers ─────────────────────────────────────────────────── */
const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100";
const textareaClass =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100 resize-none";

function Field({ label, required = false, children, className = "" }) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-blue-950">
        {label}{required && <span className="ml-1 text-rose-500">*</span>}
      </label>
      {children}
    </div>
  );
}

/* ─── Autocomplete terceiro (busca server-side) ──────────────── */
function TerceiroAutocomplete({ value, onChange, onSelect }) {
  const [options, setOptions] = useState([]);
  const [show, setShow] = useState(false);
  const ref = useRef();
  const debounce = useRef(null);

  async function search(q) {
    if (!q.trim()) { setOptions([]); return; }
    const { data } = await supabase
      .from("suprimentos_fornecedores")
      .select("id, nome, cnpj, telefone")
      .or(`nome.ilike.%${q.trim()}%,cnpj.ilike.%${q.trim()}%`)
      .eq("ativo", true)
      .order("nome")
      .limit(8);
    setOptions(data || []);
  }

  useEffect(() => {
    function handler(e) { if (ref.current && !ref.current.contains(e.target)) setShow(false); }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <input
        className={inputClass}
        placeholder="Nome ou razão social do terceiro"
        value={value}
        autoComplete="off"
        onChange={(e) => {
          onChange(e.target.value);
          setShow(true);
          clearTimeout(debounce.current);
          debounce.current = setTimeout(() => search(e.target.value), 300);
        }}
        onFocus={() => { if (options.length > 0) setShow(true); }}
      />
      {show && options.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden">
          {options.map((f) => (
            <button
              key={f.id}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); onSelect(f); setShow(false); setOptions([]); }}
              className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-blue-50 border-b border-slate-50 last:border-0"
            >
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-800">{f.nome}</p>
                {(f.cnpj || f.telefone) && (
                  <p className="text-xs text-slate-400">{[f.cnpj, f.telefone].filter(Boolean).join(" · ")}</p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── MediaViewer hook ────────────────────────────────────────── */
function useMediaViewer() {
  const [viewer, setViewer] = useState({ open: false, url: "", name: "" });
  const open = useCallback((url, name = "arquivo") => setViewer({ open: true, url, name }), []);
  const close = useCallback(() => setViewer({ open: false, url: "", name: "" }), []);
  return { viewer, openViewer: open, closeViewer: close };
}

function isVideoUrl(url) {
  return /\.(mp4|mov|webm|ogg)(\?|#|$)/i.test(url || "");
}

/* thumbnail clicável que abre o viewer */
function MediaThumb({ url, onOpen, onRemove }) {
  const isVid = isVideoUrl(url);
  return (
    <div className="group relative">
      {isVid ? (
        <button type="button" onClick={() => onOpen(url, "vídeo")}
          className="flex h-16 w-16 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 text-slate-500 hover:bg-slate-200">
          <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 20 20"><path d="M6.3 2.841A1.5 1.5 0 004 4.11v11.78a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.841z" /></svg>
        </button>
      ) : (
        <button type="button" onClick={() => onOpen(url, "imagem")} className="block">
          <img src={url} alt="" className="h-16 w-16 rounded-xl object-cover border border-slate-200 hover:opacity-80 transition" />
        </button>
      )}
      {onRemove && (
        <button type="button" onClick={() => onRemove(url)}
          className="absolute -right-1 -top-1 hidden rounded-full bg-rose-500 p-0.5 text-[10px] text-white group-hover:flex">
          <FaTimes />
        </button>
      )}
    </div>
  );
}

/* ─── EvidenciasDropzone (estilo SAC) ────────────────────────── */
const ACCEPT_MIME = ["image/png", "image/jpeg", "image/webp", "image/heic", "video/mp4", "video/quicktime", "application/pdf"];

function EvidenciasDropzone({ files, setFiles }) {
  const [isDragging, setIsDragging] = useState(false);
  const fileRef = useRef();

  function keyFile(f) { return `${f.name}-${f.size}-${f.lastModified}`; }

  function addFiles(list) {
    const incoming = Array.from(list || []).filter((f) => ACCEPT_MIME.includes(f.type));
    const existing = new Set(files.map(keyFile));
    const deduped = incoming.filter((f) => !existing.has(keyFile(f)));
    if (deduped.length) setFiles((prev) => [...prev, ...deduped]);
  }

  function onPaste(e) {
    const items = Array.from(e.clipboardData?.items || []);
    const imgs = items.filter((it) => it.kind === "file" && it.type.startsWith("image/")).map((it) => it.getAsFile()).filter(Boolean);
    if (!imgs.length) return;
    e.preventDefault();
    addFiles(imgs.map((f) => new File([f], `print_${Date.now()}.${f.type.includes("png") ? "png" : "jpg"}`, { type: f.type, lastModified: Date.now() })));
  }

  function badgeLabel(f) {
    if (f.type.startsWith("image/")) return "Imagem";
    if (f.type.startsWith("video/")) return "Vídeo";
    if (f.type === "application/pdf") return "PDF";
    return "Arquivo";
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* dropzone */}
        <div
          tabIndex={0}
          onPaste={onPaste}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => { e.preventDefault(); setIsDragging(false); addFiles(e.dataTransfer.files); }}
          onClick={() => fileRef.current?.click()}
          className={`flex min-h-[140px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDragging ? "border-blue-500 bg-blue-50" : "border-slate-300 bg-slate-50 hover:bg-slate-100"}`}
        >
          <p className="text-sm font-semibold text-slate-700">Clique para enviar <span className="font-normal">ou arraste</span></p>
          <p className="mt-1 text-xs text-slate-400">PNG, JPG, MP4, MOV ou PDF</p>
          <input ref={fileRef} type="file" accept={ACCEPT_MIME.join(",")} multiple className="hidden" onChange={(e) => addFiles(e.target.files)} />
        </div>
        {/* paste box */}
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div
            tabIndex={0}
            onPaste={onPaste}
            className="rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <p>Clique aqui e cole seu print.</p>
            <p className="mt-1 text-xs text-slate-400">Somente imagens do clipboard.</p>
          </div>
          <p className="mt-3 text-xs text-slate-400">
            {files.length > 0 ? <><b>{files.length}</b> arquivo(s) anexado(s)</> : "Nenhum arquivo ainda"}
          </p>
        </div>
      </div>

      {files.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Arquivos anexados</p>
            <button type="button" onClick={() => setFiles([])} className="text-xs font-semibold text-rose-500 hover:underline">remover tudo</button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {files.map((f, i) => (
              <div key={`${f.name}-${i}`} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-600 flex-shrink-0">{badgeLabel(f)}</span>
                  <span className="truncate text-xs font-semibold text-slate-700">{f.name}</span>
                </div>
                <button type="button" onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))} className="ml-2 flex-shrink-0 text-rose-400 hover:text-rose-600"><FaTimes /></button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function statusMeta(status) {
  if (status === "Retornado")          return { tone: "emerald", label: "Retornado" };
  if (status === "Cancelado")          return { tone: "rose",    label: "Cancelado" };
  return                                      { tone: "amber",   label: "Em posse do terceiro" };
}

const EMPTY_ITEM = { peca_id: "", codigo: "", descricao: "", quantidade: "1", unidade: "un", obs: "", fotos_urls: [] };

/* ─── upload fotos (reutiliza bucket suprimentos) ─────────────── */
async function uploadFotos(files) {
  if (!files || files.length === 0) return [];
  const urls = await uploadSuprimentosFiles(Array.from(files));
  return urls;
}

/* ─── PecasCatalogPicker ──────────────────────────────────────── */
function PecasCatalogPicker({ onSelect, onClose }) {
  const [pecas, setPecas] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(async () => {
      setLoading(true);
      const q = search.trim().replace(/[,%]/g, " ");
      let request = supabase
        .from("suprimentos_pecas")
        .select("*")
        .eq("ativo", true)
        .order("descricao")
        .limit(20);

      if (q) request = request.or(`descricao.ilike.%${q}%,codigo.ilike.%${q}%`);

      const { data } = await request;
      setPecas(data || []);
      setLoading(false);
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl bg-white shadow-2xl border border-slate-200">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h3 className="text-base font-semibold text-slate-900">Selecionar Peça do Catálogo</h3>
          <button onClick={onClose} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100"><FaTimes /></button>
        </div>
        <div className="px-4 py-3 border-b border-slate-100">
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2">
            <FaSearch className="text-slate-400 text-xs" />
            <input autoFocus className="bg-transparent outline-none text-sm font-semibold text-slate-700 placeholder:text-slate-400 w-full" placeholder="Buscar peça…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
        <div className="max-h-72 overflow-y-auto">
          {loading ? (
            <p className="py-8 text-center text-sm text-slate-400">Carregando…</p>
          ) : pecas.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">Nenhuma peça encontrada.</p>
          ) : (
            pecas.map((p) => (
              <button
                key={p.id}
                onClick={() => onSelect(p)}
                className="flex w-full items-start gap-3 px-5 py-3 text-left hover:bg-blue-50 border-b border-slate-50 last:border-0"
              >
                <span className="mt-0.5 rounded-lg bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-500">{p.codigo || "—"}</span>
                <div>
                  <p className="text-sm font-semibold text-slate-800">{p.descricao}</p>
                  <p className="text-xs text-slate-400">{p.unidade_padrao}</p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── ItemRow ─────────────────────────────────────────────────── */
function ItemRow({ item, index, onChange, onRemove, onPickCatalog, readOnly }) {
  const fileRef = useRef();
  const [uploading, setUploading] = useState(false);
  const { viewer, openViewer, closeViewer } = useMediaViewer();

  function handle(field) {
    return (e) => onChange(index, { ...item, [field]: e.target.value });
  }

  async function handleFotos(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    const urls = await uploadFotos(files);
    onChange(index, { ...item, fotos_urls: [...(item.fotos_urls || []), ...urls] });
    setUploading(false);
    e.target.value = "";
  }

  return (
    <>
      <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 space-y-3">
        <div className="flex items-start gap-2">
          {!readOnly && (
            <button type="button" onClick={() => onPickCatalog(index)}
              className="mt-0.5 flex-shrink-0 rounded-xl border border-blue-200 bg-blue-50 px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-blue-700 hover:bg-blue-100"
              title="Selecionar do catálogo">
              <FaList />
            </button>
          )}
          <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-4">
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-400">Código</p>
              <input className={inputClass + " text-xs"} placeholder="Código" value={item.codigo} onChange={handle("codigo")} disabled={readOnly} />
            </div>
            <div className="sm:col-span-2">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-400">Descrição *</p>
              <PartAutocomplete
                className={inputClass + " text-xs"}
                placeholder="Descricao da peca"
                value={item.descricao}
                onChange={(value) => onChange(index, { ...item, descricao: value })}
                onSelect={(peca) =>
                  onChange(index, {
                    ...item,
                    peca_id: peca.id,
                    codigo: peca.codigo || item.codigo,
                    descricao: peca.descricao || item.descricao,
                    unidade: peca.unidade_padrao || item.unidade,
                  })
                }
                disabled={readOnly}
              />
            </div>
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-blue-900">Qtd</p>
              <div className="flex gap-1">
                <input className={inputClass + " text-xs"} type="number" min="0" value={item.quantidade} onChange={handle("quantidade")} disabled={readOnly} />
                <input className={inputClass + " text-xs w-16"} placeholder="un" value={item.unidade} onChange={handle("unidade")} disabled={readOnly} />
              </div>
            </div>
          </div>
          {!readOnly && (
            <button type="button" onClick={() => onRemove(index)} className="mt-0.5 flex-shrink-0 rounded-xl p-2 text-rose-400 hover:bg-rose-50">
              <FaTimes />
            </button>
          )}
        </div>

        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-400">Observação</p>
          <input className={inputClass + " text-xs"} placeholder="Observação sobre este item…" value={item.obs} onChange={handle("obs")} disabled={readOnly} />
        </div>

        {(item.fotos_urls || []).length > 0 && (
          <div className="flex flex-wrap gap-2">
            {(item.fotos_urls || []).map((url, i) => (
              <MediaThumb
                key={i}
                url={url}
                onOpen={openViewer}
                onRemove={!readOnly ? (u) => onChange(index, { ...item, fotos_urls: item.fotos_urls.filter((x) => x !== u) }) : null}
              />
            ))}
          </div>
        )}
      </div>

      <FileViewerModal open={viewer.open} url={viewer.url} name={viewer.name} onClose={closeViewer} />
    </>
  );
}

/* ─── print ficha ─────────────────────────────────────────────── */
function legacyPrintFicha(record) {
  const itensHtml = (record.itens || [])
    .map(
      (it, i) => `<tr>
        <td>${i + 1}</td>
        <td>${it.codigo || "—"}</td>
        <td>${it.descricao || ""}</td>
        <td>${it.quantidade || ""} ${it.unidade || ""}</td>
        <td>${it.obs || ""}</td>
      </tr>`
    ).join("");

  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"/>
<title>Serviço Externo ${record.numero_saida}</title>
<style>
  *{box-sizing:border-box;font-family:Arial,sans-serif;}
  body{margin:0;padding:24px;font-size:13px;color:#1e293b;}
  h1{font-size:20px;font-weight:900;margin:0 0 2px;}
  .sub{font-size:11px;color:#64748b;margin-bottom:16px;}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:8px 24px;margin-bottom:16px;}
  .field label{font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:.1em;color:#94a3b8;}
  .field p{margin:2px 0 0;font-weight:700;}
  table{width:100%;border-collapse:collapse;margin-bottom:24px;}
  thead tr{background:#f1f5f9;}
  th{font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:.08em;padding:6px 8px;text-align:left;border:1px solid #e2e8f0;}
  td{padding:5px 8px;border:1px solid #e2e8f0;vertical-align:top;}
  .sig{margin-top:40px;display:grid;grid-template-columns:1fr 1fr;gap:40px;}
  .sig-block{border-top:1.5px solid #1e293b;padding-top:6px;font-size:11px;}
  @media print{body{padding:10mm 14mm;}}
</style></head><body>
  <h1>Serviço Externo — Ficha de Saída</h1>
  <p class="sub">Gerado em ${new Date().toLocaleString("pt-BR")}</p>
  <div class="grid">
    <div class="field"><label>Número</label><p>${record.numero_saida||"—"}</p></div>
    <div class="field"><label>Status</label><p>${record.status}</p></div>
    <div class="field"><label>Nota de Saída</label><p>${record.nota_saida_numero||"—"} ${record.nota_saida_data?"· "+formatDateBR(record.nota_saida_data):""}</p></div>
    <div class="field"><label>Nota de Retorno</label><p>${record.nota_retorno_numero||"—"} ${record.nota_retorno_data?"· "+formatDateBR(record.nota_retorno_data):""}</p></div>
    <div class="field"><label>Terceiro</label><p>${record.terceiro_nome||"—"}</p></div>
    <div class="field"><label>CPF/CNPJ</label><p>${record.terceiro_cpf_cnpj||"—"}</p></div>
    <div class="field"><label>Telefone</label><p>${record.terceiro_telefone||"—"}</p></div>
    <div class="field"><label>Endereço</label><p>${record.terceiro_endereco||"—"}</p></div>
    <div class="field" style="grid-column:1/-1"><label>Motivo / Serviço</label><p>${record.motivo||"—"}</p></div>
    ${record.observacao?`<div class="field" style="grid-column:1/-1"><label>Observações</label><p>${record.observacao}</p></div>`:""}
  </div>
  <table><thead><tr><th>#</th><th>Código</th><th>Descrição</th><th>Qtd/Un</th><th>Obs.</th></tr></thead>
  <tbody>${itensHtml||'<tr><td colspan="5">Nenhum item.</td></tr>'}</tbody></table>
  <div class="sig">
    <div class="sig-block"><p><strong>Responsável pela entrega</strong></p>
      <p style="margin-top:4px;font-size:11px;color:#64748b">${record.criado_por_nome||"—"}</p>
      <p style="margin-top:4px;font-size:11px;color:#64748b">Data: ___/___/______</p></div>
    <div class="sig-block"><p><strong>Assinatura do Terceiro (recebimento)</strong></p>
      <p style="margin-top:4px;font-size:11px;color:#64748b">${record.terceiro_nome||"—"}</p>
      <p style="margin-top:4px;font-size:11px;color:#64748b">Data: ___/___/______</p></div>
    <div class="sig-block" style="margin-top:32px"><p><strong>Responsável pelo recebimento (retorno)</strong></p>
      <p style="margin-top:4px;font-size:11px;color:#64748b">Data: ___/___/______</p></div>
    <div class="sig-block" style="margin-top:32px"><p><strong>Assinatura do Terceiro (devolução)</strong></p>
      <p style="margin-top:4px;font-size:11px;color:#64748b">Data: ___/___/______</p></div>
  </div>
</body></html>`;

  const w = window.open("", "_blank", "width=900,height=700");
  w.document.write(html);
  w.document.close();
  w.focus();
  w.print();
}

function escapePrintHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function printFicha(record) {
  const status = record.status || "Em posse do terceiro";
  const statusClass =
    status === "Retornado" ? "status-retornado" :
    status === "Cancelado" ? "status-cancelado" :
    "status-aberto";
  const sectionAssinaturas = record.observacao ? "5" : "4";
  const itensHtml = (record.itens || [])
    .map((it, i) => `<tr>
      <td>${i + 1}</td>
      <td>${escapePrintHtml(it.codigo || "-")}</td>
      <td>${escapePrintHtml(it.descricao || "")}</td>
      <td>${escapePrintHtml(`${it.quantidade || ""} ${it.unidade || ""}`.trim())}</td>
      <td>${escapePrintHtml(it.obs || "")}</td>
    </tr>`)
    .join("");

  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"/>
<title>Serviço Externo ${escapePrintHtml(record.numero_saida || "")}</title>
<style>
  @page { margin: 14mm; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; box-sizing: border-box; }
  body { margin: 0; padding: 0; font-family: Arial, sans-serif; font-size: 11px; line-height: 1.35; color: #0f172a; }
  h1, h2, h3, p { margin: 0; padding: 0; }
  .nobreak { break-inside: avoid; page-break-inside: avoid; }
  .mb-3 { margin-bottom: 12px; }
  .mt-4 { margin-top: 16px; }
  .doc-header {
    display: flex; align-items: stretch; justify-content: space-between; gap: 16px;
    border-bottom: 3px solid #1e3a8a; padding-bottom: 10px; margin-bottom: 12px;
  }
  .brand { display: flex; align-items: center; gap: 10px; min-width: 140px; align-self: center; }
  .brand img { width: 48px; height: 48px; object-fit: contain; display: block; }
  .brand-text { line-height: 1.1; }
  .brand-name { font-size: 20px; font-weight: 800; color: #1e3a8a; letter-spacing: 0.12em; }
  .brand-sub { font-size: 8.5px; color: #64748b; letter-spacing: 0.18em; text-transform: uppercase; margin-top: 2px; }
  .doc-title-block { flex: 1; text-align: center; align-self: center; }
  .doc-title { font-size: 18px; font-weight: 800; color: #1e3a8a; letter-spacing: 0.04em; line-height: 1.15; }
  .doc-subtitle { font-size: 10px; color: #475569; margin-top: 2px; }
  .doc-meta {
    text-align: right; font-size: 9.5px; color: #475569;
    display: flex; flex-direction: column; align-items: flex-end; gap: 4px;
    min-width: 140px; align-self: center;
  }
  .status-pill {
    display: inline-block; padding: 2px 10px; border-radius: 999px;
    font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;
  }
  .status-aberto { background: #fef3c7; color: #92400e; border: 1px solid #fbbf24; }
  .status-retornado { background: #dcfce7; color: #166534; border: 1px solid #22c55e; }
  .status-cancelado { background: #fee2e2; color: #991b1b; border: 1px solid #ef4444; }
  .section-title {
    background: #1e3a8a; color: #fff; font-size: 11px; font-weight: 700;
    text-transform: uppercase; letter-spacing: 0.04em;
    padding: 8px 10px; margin-bottom: 6px; border-radius: 2px;
    line-height: 1; break-after: avoid-page; page-break-after: avoid;
  }
  .field-grid {
    display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px 12px;
    border: 1px solid #cbd5e1; padding: 8px 10px; border-radius: 3px; background: #f8fafc;
  }
  .field-grid .full { grid-column: 1 / -1; }
  .field-label {
    font-size: 9px; color: #475569; text-transform: uppercase;
    letter-spacing: 0.05em; font-weight: 600; display: block;
  }
  .field-value { font-size: 11px; color: #0f172a; font-weight: 600; }
  table { width: 100%; border-collapse: collapse; break-inside: auto; }
  tr { break-inside: avoid; page-break-inside: avoid; }
  thead { display: table-header-group; }
  .compact th, .compact td { padding: 4px 6px; border: 1px solid #cbd5e1; vertical-align: top; }
  .compact thead th {
    background: #1e3a8a; color: #fff; font-weight: 600; font-size: 10px;
    text-transform: uppercase; letter-spacing: 0.03em; text-align: left;
  }
  .compact tbody tr:nth-child(even) td { background: #f8fafc; }
  .note-box {
    border: 1px solid #cbd5e1; border-radius: 3px; padding: 8px 10px;
    background: #f8fafc; min-height: 42px; font-size: 11px; white-space: pre-wrap;
  }
  .signature-box { text-align: center; }
  .signature-line {
    border-top: 1px solid #0f172a; margin: 40px 8px 4px 8px; padding-top: 3px;
    font-size: 10px; font-weight: 600;
  }
  .signature-role { font-size: 9px; color: #475569; }
  .footer-disclaimer {
    margin-top: 12px; font-size: 8.5px; color: #64748b; text-align: justify;
    border-top: 1px dashed #cbd5e1; padding-top: 6px;
  }
</style></head><body>
  <header class="doc-header nobreak">
    <div class="brand">
      <img src="${logoInove}" alt="INOVE" />
      <div class="brand-text">
        <div class="brand-name">INOVE</div>
        <div class="brand-sub">Gestão de Frota</div>
      </div>
    </div>
    <div class="doc-title-block">
      <h1 class="doc-title">SERVIÇO EXTERNO</h1>
      <div class="doc-subtitle">Ficha de saída e controle de retorno</div>
    </div>
    <div class="doc-meta">
      <div><strong>Nº:</strong> ${escapePrintHtml(record.numero_saida || "-")}</div>
      <div><strong>Emissão:</strong> ${escapePrintHtml(new Date().toLocaleString("pt-BR"))}</div>
      <div><span class="status-pill ${statusClass}">${escapePrintHtml(status)}</span></div>
    </div>
  </header>

  <section class="mb-3 nobreak">
    <div class="section-title">1. Identificação da saída</div>
    <div class="field-grid">
      <div><span class="field-label">Número</span><span class="field-value">${escapePrintHtml(record.numero_saida || "-")}</span></div>
      <div><span class="field-label">Status</span><span class="field-value">${escapePrintHtml(status)}</span></div>
      <div><span class="field-label">Nota de saída</span><span class="field-value">${escapePrintHtml(record.nota_saida_numero || "-")}</span></div>
      <div><span class="field-label">Data da saída</span><span class="field-value">${escapePrintHtml(record.nota_saida_data ? formatDateBR(record.nota_saida_data) : "-")}</span></div>
      <div><span class="field-label">Nota de retorno</span><span class="field-value">${escapePrintHtml(record.nota_retorno_numero || "-")}</span></div>
      <div><span class="field-label">Data do retorno</span><span class="field-value">${escapePrintHtml(record.nota_retorno_data ? formatDateBR(record.nota_retorno_data) : "-")}</span></div>
      <div class="full"><span class="field-label">Motivo / Serviço</span><span class="field-value">${escapePrintHtml(record.motivo || "-")}</span></div>
    </div>
  </section>

  <section class="mb-3 nobreak">
    <div class="section-title">2. Dados do terceiro</div>
    <div class="field-grid">
      <div style="grid-column:1 / span 2"><span class="field-label">Nome / Razão social</span><span class="field-value">${escapePrintHtml(record.terceiro_nome || "-")}</span></div>
      <div><span class="field-label">CPF / CNPJ</span><span class="field-value">${escapePrintHtml(record.terceiro_cpf_cnpj || "-")}</span></div>
      <div><span class="field-label">Telefone</span><span class="field-value">${escapePrintHtml(record.terceiro_telefone || "-")}</span></div>
      <div class="full"><span class="field-label">Endereço</span><span class="field-value">${escapePrintHtml(record.terceiro_endereco || "-")}</span></div>
    </div>
  </section>

  <section class="mb-3 nobreak">
    <div class="section-title">3. Itens enviados</div>
    <table class="compact">
      <thead><tr><th style="width:36px">#</th><th style="width:95px">Código</th><th>Descrição</th><th style="width:90px">Qtd/Un</th><th>Obs.</th></tr></thead>
      <tbody>${itensHtml || '<tr><td colspan="5" style="text-align:center;padding:8px">Nenhum item.</td></tr>'}</tbody>
    </table>
  </section>

  ${record.observacao ? `
  <section class="mb-3 nobreak">
    <div class="section-title">4. Observações</div>
    <div class="note-box">${escapePrintHtml(record.observacao)}</div>
  </section>` : ""}

  <section class="mt-4 nobreak">
    <div class="section-title">${sectionAssinaturas}. Assinaturas</div>
    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:18px 26px;margin-top:8px">
      <div class="signature-box">
        <div class="signature-line">Responsável pela entrega</div>
        <div class="signature-role">${escapePrintHtml(record.criado_por_nome || "-")}</div>
      </div>
      <div class="signature-box">
        <div class="signature-line">${escapePrintHtml(record.terceiro_nome || "Terceiro")}</div>
        <div class="signature-role">Assinatura do terceiro (recebimento)</div>
      </div>
      <div class="signature-box">
        <div class="signature-line">Responsável pelo recebimento</div>
        <div class="signature-role">Retorno / conferência</div>
      </div>
      <div class="signature-box">
        <div class="signature-line">${escapePrintHtml(record.terceiro_nome || "Terceiro")}</div>
        <div class="signature-role">Assinatura do terceiro (devolução)</div>
      </div>
    </div>
  </section>

  <div class="footer-disclaimer">
    Este documento registra a saída de itens para serviço externo e seu controle de retorno, conforme dados
    lançados no sistema. As partes signatárias declaram ciência dos itens, quantidades e condições descritas.
  </div>
</body></html>`;

  const w = window.open("", "_blank", "width=900,height=700");
  w.document.write(html);
  w.document.close();
  w.focus();
  w.print();
}

/* ─── emptyForm ───────────────────────────────────────────────── */
function emptyForm() {
  return {
    nota_saida_numero: "",
    nota_saida_data: todayISO(),
    nota_retorno_numero: "",
    nota_retorno_data: "",
    terceiro_nome: "",
    terceiro_cpf_cnpj: "",
    terceiro_telefone: "",
    terceiro_endereco: "",
    motivo: "",
    observacao: "",
    itens: [{ ...EMPTY_ITEM }],
  };
}

/* ════════════════════════════════════════════════════════════════
   MODAL — NOVO / EDITAR
═══════════════════════════════════════════════════════════════════ */
function SaidaModal({ editRecord = null, onClose, onSaved, userInfo }) {
  const isEdit = !!editRecord;
  const [form, setForm] = useState(
    isEdit
      ? {
          nota_saida_numero: editRecord.nota_saida_numero || "",
          nota_saida_data: editRecord.nota_saida_data || todayISO(),
          terceiro_nome: editRecord.terceiro_nome || "",
          terceiro_cpf_cnpj: editRecord.terceiro_cpf_cnpj || "",
          terceiro_telefone: editRecord.terceiro_telefone || "",
          terceiro_endereco: editRecord.terceiro_endereco || "",
          motivo: editRecord.motivo || "",
          observacao: editRecord.observacao || "",
          itens: editRecord.itens?.length ? editRecord.itens : [{ ...EMPTY_ITEM }],
        }
      : emptyForm()
  );
  const [files, setFiles] = useState([]); // evidências gerais da saída
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [catalogTarget, setCatalogTarget] = useState(null);

  function setF(key, value) { setForm((f) => ({ ...f, [key]: value })); }

  function handleTerceiroSelect(fornecedor) {
    setForm((f) => ({
      ...f,
      terceiro_nome: fornecedor.nome,
      terceiro_cpf_cnpj: fornecedor.cnpj || f.terceiro_cpf_cnpj,
      terceiro_telefone: fornecedor.telefone || f.terceiro_telefone,
      terceiro_endereco: fornecedor.terceiro_endereco || f.terceiro_endereco,
    }));
  }

  function handleItemChange(index, newItem) {
    const updated = [...form.itens];
    updated[index] = newItem;
    setForm((f) => ({ ...f, itens: updated }));
  }

  function addItem() {
    setForm((f) => ({ ...f, itens: [...f.itens, { ...EMPTY_ITEM }] }));
  }

  function removeItem(index) {
    setForm((f) => ({ ...f, itens: f.itens.filter((_, i) => i !== index) }));
  }

  function handleCatalogSelect(peca) {
    if (catalogTarget === null) return;
    handleItemChange(catalogTarget, {
      ...form.itens[catalogTarget],
      peca_id: peca.id,
      codigo: peca.codigo || "",
      descricao: peca.descricao,
      unidade: peca.unidade_padrao || "un",
    });
    setCatalogTarget(null);
  }

  async function handleSave() {
    if (!form.terceiro_nome.trim()) { setError("Informe o nome do terceiro."); return; }
    if (!form.motivo.trim()) { setError("Informe o motivo / serviço."); return; }
    const validItens = form.itens.filter((it) => it.descricao.trim());
    if (validItens.length === 0) { setError("Adicione ao menos um item."); return; }

    setSaving(true); setError("");

    // upload evidências gerais
    let evidencias_urls = [];
    if (files.length > 0) {
      evidencias_urls = await uploadSuprimentosFiles(files, `servico-externo/${Date.now()}`);
    }

    const payload = {
      nota_saida_numero: form.nota_saida_numero || null,
      nota_saida_data: form.nota_saida_data || null,
      terceiro_nome: form.terceiro_nome.trim(),
      terceiro_cpf_cnpj: form.terceiro_cpf_cnpj || null,
      terceiro_telefone: form.terceiro_telefone || null,
      terceiro_endereco: form.terceiro_endereco || null,
      motivo: form.motivo.trim(),
      observacao: form.observacao || null,
      itens: validItens,
      ...(evidencias_urls.length > 0 ? { evidencias_urls } : {}),
    };

    let err;
    if (isEdit) {
      ({ error: err } = await supabase.from("suprimentos_servico_externo").update(payload).eq("id", editRecord.id));
    } else {
      payload.criado_por_id = userInfo?.id || null;
      payload.criado_por_login = userInfo?.login || null;
      payload.criado_por_nome = userInfo?.nome || null;
      ({ error: err } = await supabase.from("suprimentos_servico_externo").insert(payload));
    }

    setSaving(false);
    if (err) { setError(err.message); return; }

    // auto-insert movimentação de saída se novo
    if (!isEdit) {
      const { data: novo } = await supabase.from("suprimentos_servico_externo").select("id").order("created_at", { ascending: false }).limit(1).single();
      if (novo) {
        await supabase.from("suprimentos_se_movimentacoes").insert({
          se_id: novo.id,
          tipo: "Saída",
          descricao: `Saída registrada. Motivo: ${payload.motivo}`,
          criado_por_id: userInfo?.id || null,
          criado_por_login: userInfo?.login || null,
          criado_por_nome: userInfo?.nome || null,
        });
      }
    }
    onSaved();
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-sm">
        <div className="my-8 w-full max-w-5xl rounded-xl border border-slate-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-blue-600">Serviço Externo</p>
              <h2 className="mt-1 text-xl font-semibold text-blue-900">{isEdit ? "Editar Saída" : "Nova Saída"}</h2>
            </div>
            <button onClick={onClose} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100"><FaTimes /></button>
          </div>

          <div className="px-6 py-5 space-y-5">
            {/* NF + Terceiro — linha compacta */}
            <div className="grid grid-cols-2 gap-4">
              <Field label="NF de Saída" required>
                <input className={inputClass} placeholder="ex.: 001234" value={form.nota_saida_numero} onChange={(e) => setF("nota_saida_numero", e.target.value)} />
              </Field>
              <Field label="Data de emissão">
                <input type="date" className={inputClass} value={form.nota_saida_data} onChange={(e) => setF("nota_saida_data", e.target.value)} />
              </Field>
            </div>

            {/* Terceiro com autocomplete */}
            <div className="grid grid-cols-2 gap-4">
              <Field label="Nome / Razão Social" required className="col-span-2">
                <SupplierAutocomplete
                  className={inputClass}
                  value={form.terceiro_nome}
                  onChange={(v) => setF("terceiro_nome", v)}
                  onSelect={handleTerceiroSelect}
                  placeholder="Nome ou razao social do terceiro"
                  required
                />
              </Field>
              <Field label="CPF / CNPJ">
                <input className={inputClass} placeholder="000.000.000-00" value={form.terceiro_cpf_cnpj} onChange={(e) => setF("terceiro_cpf_cnpj", e.target.value)} />
              </Field>
              <Field label="Telefone">
                <input className={inputClass} placeholder="(00) 00000-0000" value={form.terceiro_telefone} onChange={(e) => setF("terceiro_telefone", e.target.value)} />
              </Field>
            </div>

            {/* Motivo */}
            <Field label="Motivo / Serviço" required>
              <textarea rows={2} className={textareaClass} placeholder="Descreva o serviço a ser realizado…" value={form.motivo} onChange={(e) => setF("motivo", e.target.value)} />
            </Field>

            {/* Itens */}
            <div>
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-widest text-blue-900">Itens enviados</p>
                <button type="button" onClick={addItem} className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700">
                  <FaPlus /> Adicionar item
                </button>
              </div>
              <div className="space-y-3">
                {form.itens.map((item, i) => (
                  <ItemRow
                    key={i}
                    item={item}
                    index={i}
                    onChange={handleItemChange}
                    onRemove={removeItem}
                    onPickCatalog={(idx) => setCatalogTarget(idx)}
                    readOnly={false}
                  />
                ))}
              </div>
            </div>

            {/* Evidências */}
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-400">Evidências (fotos, vídeos, PDF)</p>
              <EvidenciasDropzone files={files} setFiles={setFiles} />
            </div>

            {error && (
              <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div>
            )}
          </div>

          <div className="sticky bottom-0 flex justify-end gap-3 border-t border-slate-100 bg-white px-6 py-4 rounded-b-[28px]">
            <button onClick={onClose} className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancelar</button>
            <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
              <FaTruckLoading /> {saving ? "Salvando…" : isEdit ? "Salvar alterações" : "Registrar saída"}
            </button>
          </div>
        </div>
      </div>

      {catalogTarget !== null && (
        <PecasCatalogPicker onSelect={handleCatalogSelect} onClose={() => setCatalogTarget(null)} />
      )}
    </>
  );
}

/* ════════════════════════════════════════════════════════════════
   MODAL — DETALHE + RASTREIO
═══════════════════════════════════════════════════════════════════ */
function DetalheModal({ record, onClose, onUpdated, onEdit, userInfo }) {
  const [tab, setTab] = useState("detalhes");
  const [movs, setMovs] = useState([]);
  const [loadingMovs, setLoadingMovs] = useState(true);
  const { viewer, openViewer, closeViewer } = useMediaViewer();

  // retorno form
  const [retornoForm, setRetornoForm] = useState({
    nota_retorno_numero: record.nota_retorno_numero || "",
    nota_retorno_data: record.nota_retorno_data || todayISO(),
    descricao: "",
    valor: "",
    qtd_retornada: "",
    aprovado: "Sim",
    fotos: [],
  });
  const [retornoFiles, setRetornoFiles] = useState([]);

  // observação form
  const [obsForm, setObsForm] = useState({ descricao: "" });

  // cancelar form
  const [cancelarMotivo, setCancelarMotivo] = useState(record.cancelado_motivo || "");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const meta = statusMeta(record.status);
  const canAct = record.status === "Em posse do terceiro";

  async function loadMovs() {
    setLoadingMovs(true);
    const { data } = await supabase
      .from("suprimentos_se_movimentacoes")
      .select("*")
      .eq("se_id", record.id)
      .order("created_at", { ascending: true });
    setMovs(data || []);
    setLoadingMovs(false);
  }

  useEffect(() => { loadMovs(); }, []);

  async function registrarRetorno() {
    setSaving(true); setError("");
    let uploadedUrls = [];
    if (retornoFiles.length > 0) {
      uploadedUrls = await uploadSuprimentosFiles(retornoFiles, `servico-externo/${record.id}/retorno`);
    }
    const aprovado = retornoForm.aprovado === "Sim";
    const descricaoMov = [
      aprovado ? "Servico aprovado." : "Servico nao aprovado.",
      retornoForm.descricao,
    ].filter(Boolean).join(" ");
    const { error: err } = await supabase.from("suprimentos_servico_externo").update({
      status: "Retornado",
      nota_retorno_numero: retornoForm.nota_retorno_numero || null,
      nota_retorno_data: retornoForm.nota_retorno_data || null,
      retornado_em: new Date().toISOString(),
      retornado_obs: retornoForm.descricao || null,
      servico_aprovado: aprovado,
      valor_aprovado: retornoForm.valor ? Number(retornoForm.valor) : null,
    }).eq("id", record.id);
    if (err) { setError(err.message); setSaving(false); return; }
    await supabase.from("suprimentos_se_movimentacoes").insert({
      se_id: record.id,
      tipo: "Retorno",
      descricao: descricaoMov || "Retorno registrado.",
      fotos_urls: uploadedUrls,
      valor: retornoForm.valor ? Number(retornoForm.valor) : null,
      qtd_retornada: retornoForm.qtd_retornada ? Number(retornoForm.qtd_retornada) : null,
      criado_por_id: userInfo?.id || null,
      criado_por_login: userInfo?.login || null,
      criado_por_nome: userInfo?.nome || null,
    });
    setSaving(false);
    onUpdated();
  }

  async function registrarObservacao() {
    if (!obsForm.descricao.trim()) { setError("Informe a observação."); return; }
    setSaving(true); setError("");
    const { error: err } = await supabase.from("suprimentos_se_movimentacoes").insert({
      se_id: record.id,
      tipo: "Observação",
      descricao: obsForm.descricao.trim(),
      criado_por_id: userInfo?.id || null,
      criado_por_login: userInfo?.login || null,
      criado_por_nome: userInfo?.nome || null,
    });
    setSaving(false);
    if (err) { setError(err.message); return; }
    setObsForm({ descricao: "" });
    setTab("rastreio");
    loadMovs();
  }

  async function cancelar() {
    if (!cancelarMotivo.trim()) { setError("Informe o motivo do cancelamento."); return; }
    setSaving(true); setError("");
    const { error: err } = await supabase.from("suprimentos_servico_externo").update({
      status: "Cancelado",
      cancelado_motivo: cancelarMotivo.trim(),
      cancelado_em: new Date().toISOString(),
    }).eq("id", record.id);
    if (err) { setError(err.message); setSaving(false); return; }
    await supabase.from("suprimentos_se_movimentacoes").insert({
      se_id: record.id,
      tipo: "Cancelamento",
      descricao: `Cancelado. Motivo: ${cancelarMotivo.trim()}`,
      criado_por_id: userInfo?.id || null,
      criado_por_login: userInfo?.login || null,
      criado_por_nome: userInfo?.nome || null,
    });
    setSaving(false);
    onUpdated();
  }

  const MOV_TONE = { "Saída": "blue", "Observação": "slate", "Retorno": "emerald", "Cancelamento": "rose" };

  const TABS_LIST = [
    { key: "detalhes", label: "Detalhes", icon: <FaClipboardList /> },
    { key: "rastreio", label: "Rastreio", icon: <FaHistory /> },
    ...(canAct ? [
      { key: "obs", label: "Observação", icon: <FaFileAlt /> },
      { key: "retorno", label: "Registrar Retorno", icon: <FaUndoAlt /> },
      { key: "cancelar", label: "Cancelar", icon: <FaBan /> },
    ] : []),
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-sm">
      <div className="my-8 w-full max-w-5xl rounded-xl border border-slate-200 bg-white shadow-2xl">
        {/* header */}
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-blue-600">Serviço Externo</p>
              <StatusChip tone={meta.tone}>{meta.label}</StatusChip>
            </div>
            <h2 className="mt-1 text-xl font-semibold text-slate-900">{record.numero_saida}</h2>
            <p className="text-sm font-semibold text-slate-500">{record.terceiro_nome}</p>
          </div>
          <div className="flex items-center gap-2">
            {record.status === "Em posse do terceiro" && onEdit && (
              <button
                onClick={() => { onClose(); onEdit(record); }}
                className="flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100"
              >
                <FaEdit /> Editar
              </button>
            )}
            <button onClick={() => printFicha(record)} className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">
              <FaDownload /> Baixar PDF
            </button>
            <button onClick={onClose} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100"><FaTimes /></button>
          </div>
        </div>

        {/* tab bar */}
        <div className="flex flex-wrap gap-1 border-b border-slate-100 px-6 pt-3">
          {TABS_LIST.map((t) => (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); setError(""); }}
              className={`flex items-center gap-1.5 rounded-t-2xl px-3 py-2 text-xs font-semibold transition mb-0 ${
                tab === t.key ? "bg-blue-600 text-white" : "text-slate-500 hover:bg-slate-100"
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* ── DETALHES ── */}
          {tab === "detalhes" && (
            <>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <InfoField label="Nota de Saída" value={`${record.nota_saida_numero || "—"}${record.nota_saida_data ? " · " + formatDateBR(record.nota_saida_data) : ""}`} />
                <InfoField label="Nota de Retorno" value={`${record.nota_retorno_numero || "—"}${record.nota_retorno_data ? " · " + formatDateBR(record.nota_retorno_data) : ""}`} />
                <InfoField label="Terceiro" value={record.terceiro_nome} />
                <InfoField label="CPF / CNPJ" value={record.terceiro_cpf_cnpj} />
                <InfoField label="Telefone" value={record.terceiro_telefone} />
                <InfoField label="Endereço" value={record.terceiro_endereco} />
                <InfoField label="Motivo / Serviço" value={record.motivo} className="col-span-2" />
                {record.observacao && <InfoField label="Observações internas" value={record.observacao} className="col-span-2" />}
                {record.cancelado_motivo && <InfoField label="Motivo cancelamento" value={record.cancelado_motivo} className="col-span-2" />}
                <InfoField label="Criado por" value={record.criado_por_nome} />
                <InfoField label="Criado em" value={formatDateTimeBR(record.created_at)} />
                {record.retornado_em && <InfoField label="Retornado em" value={formatDateTimeBR(record.retornado_em)} />}
                {record.cancelado_em && <InfoField label="Cancelado em" value={formatDateTimeBR(record.cancelado_em)} />}
              </div>

              {/* itens */}
              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">Itens</p>
                <div className="space-y-3">
                  {(record.itens || []).map((it, i) => (
                    <ItemRow key={i} item={it} index={i} onChange={() => {}} onRemove={() => {}} onPickCatalog={() => {}} readOnly />
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ── RASTREIO ── */}
          {tab === "rastreio" && (
            <div>
              {loadingMovs ? (
                <p className="py-8 text-center text-sm text-slate-400">Carregando…</p>
              ) : movs.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-400">Nenhuma movimentação registrada.</p>
              ) : (
                <div className="relative pl-4">
                  <div className="absolute left-2 top-0 bottom-0 w-0.5 bg-slate-200" />
                  <div className="space-y-5">
                    {movs.map((m) => {
                      const tone = MOV_TONE[m.tipo] || "slate";
                      return (
                        <div key={m.id} className="relative">
                          <div className={`absolute -left-2.5 top-1 h-4 w-4 rounded-full border-2 border-white ${tone === "blue" ? "bg-blue-500" : tone === "emerald" ? "bg-emerald-500" : tone === "rose" ? "bg-rose-500" : "bg-slate-400"}`} />
                          <div className="ml-4 rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
                            <div className="flex items-center gap-2 mb-1">
                              <StatusChip tone={tone}>{m.tipo}</StatusChip>
                              <span className="text-xs text-slate-400">{formatDateTimeBR(m.created_at)}</span>
                              {m.criado_por_nome && <span className="text-xs font-semibold text-slate-500">· {m.criado_por_nome}</span>}
                            </div>
                            {m.descricao && <p className="text-sm font-semibold text-slate-800">{m.descricao}</p>}
                            <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
                              {m.valor != null && <span>💰 R$ {Number(m.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>}
                              {m.qtd_retornada != null && <span>📦 {m.qtd_retornada} un. retornadas</span>}
                            </div>
                            {(m.fotos_urls || []).length > 0 && (
                              <div className="mt-3 flex flex-wrap gap-2">
                                {m.fotos_urls.map((url, i) => (
                                  <MediaThumb key={i} url={url} onOpen={openViewer} />
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── OBSERVAÇÃO ── */}
          {tab === "obs" && canAct && (
            <div className="space-y-4">
              <p className="text-sm font-semibold text-slate-600">Adicione uma observação ao rastreio desta saída.</p>
              <Field label="Observação" required>
                <textarea rows={4} className={textareaClass} placeholder="Descreva a atualização…" value={obsForm.descricao} onChange={(e) => setObsForm({ descricao: e.target.value })} />
              </Field>
            </div>
          )}

          {/* ── RETORNO ── */}
          {tab === "retorno" && canAct && (
            <div className="space-y-4">
              <p className="text-sm font-semibold text-slate-600">Registre o retorno dos itens e informe o que foi realizado.</p>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Nº Nota de Retorno">
                  <input className={inputClass} placeholder="ex.: 005678" value={retornoForm.nota_retorno_numero} onChange={(e) => setRetornoForm((f) => ({ ...f, nota_retorno_numero: e.target.value }))} />
                </Field>
                <Field label="Data da Nota de Retorno">
                  <input type="date" className={inputClass} value={retornoForm.nota_retorno_data} onChange={(e) => setRetornoForm((f) => ({ ...f, nota_retorno_data: e.target.value }))} />
                </Field>
                <Field label="Servico aprovado?" required>
                  <select className={inputClass} value={retornoForm.aprovado} onChange={(e) => setRetornoForm((f) => ({ ...f, aprovado: e.target.value }))}>
                    <option value="Sim">Sim</option>
                    <option value="Nao">Nao</option>
                  </select>
                </Field>
                <Field label="Valor aprovado (R$)">
                  <input className={inputClass} type="number" placeholder="0,00" value={retornoForm.valor} onChange={(e) => setRetornoForm((f) => ({ ...f, valor: e.target.value }))} />
                </Field>
                <Field label="Qtd. retornada">
                  <input className={inputClass} type="number" placeholder="1" value={retornoForm.qtd_retornada} onChange={(e) => setRetornoForm((f) => ({ ...f, qtd_retornada: e.target.value }))} />
                </Field>
              </div>
              <Field label="O que foi feito / condição dos itens" required>
                <textarea rows={3} className={textareaClass} placeholder="Descreva o que foi realizado, condições de retorno…" value={retornoForm.descricao} onChange={(e) => setRetornoForm((f) => ({ ...f, descricao: e.target.value }))} />
              </Field>
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-400">Evidências do retorno</p>
                <EvidenciasDropzone files={retornoFiles} setFiles={setRetornoFiles} />
              </div>
            </div>
          )}

          {/* ── CANCELAR ── */}
          {tab === "cancelar" && canAct && (
            <div className="space-y-4">
              <p className="text-sm font-semibold text-slate-600">Informe o motivo do cancelamento.</p>
              <Field label="Motivo" required>
                <textarea rows={3} className={textareaClass} placeholder="Descreva o motivo…" value={cancelarMotivo} onChange={(e) => setCancelarMotivo(e.target.value)} />
              </Field>
            </div>
          )}

          {error && <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div>}
        </div>

        {/* footer */}
        <div className="sticky bottom-0 flex justify-end gap-3 border-t border-slate-100 bg-white px-6 py-4 rounded-b-[28px]">
          <button onClick={onClose} className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">Fechar</button>
          {tab === "obs" && canAct && (
            <button onClick={registrarObservacao} disabled={saving} className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
              <FaCheckCircle /> {saving ? "Salvando…" : "Salvar observação"}
            </button>
          )}
          {tab === "retorno" && canAct && (
            <button onClick={registrarRetorno} disabled={saving} className="flex items-center gap-2 rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50">
              <FaUndoAlt /> {saving ? "Salvando…" : "Confirmar retorno"}
            </button>
          )}
          {tab === "cancelar" && canAct && (
            <button onClick={cancelar} disabled={saving} className="flex items-center gap-2 rounded-xl bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50">
              <FaBan /> {saving ? "Salvando…" : "Cancelar saída"}
            </button>
          )}
        </div>
      </div>

      <FileViewerModal open={viewer.open} url={viewer.url} name={viewer.name} onClose={closeViewer} />
    </div>
  );
}

function InfoField({ label, value, className = "" }) {
  return (
    <div className={className}>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-slate-800">{value || "—"}</p>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════════════ */
const STATUS_OPTIONS = ["Todos", "Em posse do terceiro", "Retornado", "Cancelado"];

export default function SuprimentosServicoExterno() {
  const { user } = useContext(AuthContext);
  const userInfo = useMemo(() => ({
    id: user?.id || null,
    login: user?.login || user?.usuario || null,
    nome: user?.nome || user?.name || null,
  }), [user]);

  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [statusFilter, setStatusFilter] = useState("Todos");
  const [search, setSearch] = useState("");

  const [showNovo, setShowNovo] = useState(false);
  const [editRecord, setEditRecord] = useState(null);
  const [selected, setSelected] = useState(null);

  async function carregar() {
    setLoading(true); setErrorMsg("");
    const { data, error } = await supabase.from("suprimentos_servico_externo").select("*").order("created_at", { ascending: false });
    if (error) { setErrorMsg(error.message); setRecords([]); }
    else { setRecords(data || []); }
    setLoading(false);
  }
  useEffect(() => { carregar(); }, []);

  const filtered = useMemo(() => {
    return records.filter((r) => {
      const matchStatus = statusFilter === "Todos" || r.status === statusFilter;
      const q = search.toLowerCase();
      const matchSearch = !q || [r.numero_saida, r.terceiro_nome, r.motivo, r.nota_saida_numero].some((v) => (v || "").toLowerCase().includes(q));
      return matchStatus && matchSearch;
    });
  }, [records, statusFilter, search]);

  const kpis = useMemo(() => ({
    total: records.length,
    emPosse: records.filter((r) => r.status === "Em posse do terceiro").length,
    retornados: records.filter((r) => r.status === "Retornado").length,
  }), [records]);

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHero
        eyebrow="Suprimentos · Serviço Externo"
        title="Serviço Externo"
        description=""
        actions={
          <button onClick={() => setShowNovo(true)} className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-blue-700">
            <FaPlus /> Nova saída
          </button>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <KpiCard title="Total registros" value={kpis.total} icon={<FaClipboardList />} tone="blue" />
        <KpiCard title="Em posse do terceiro" value={kpis.emPosse} icon={<FaTruck />} tone="amber" />
        <KpiCard title="Retornados" value={kpis.retornados} icon={<FaUndoAlt />} tone="emerald" />
      </div>

      {/* filtros */}
      <Panel>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {STATUS_OPTIONS.map((s) => (
              <button key={s} onClick={() => setStatusFilter(s)} className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${statusFilter === s ? "bg-blue-600 text-white" : "border border-slate-200 text-slate-600 hover:bg-slate-100"}`}>{s}</button>
            ))}
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
            <FaSearch className="text-slate-400 text-xs" />
            <input className="bg-transparent outline-none text-sm font-semibold text-slate-700 placeholder:text-slate-400 w-44" placeholder="Buscar…" value={search} onChange={(e) => setSearch(e.target.value)} />
            {search && <button onClick={() => setSearch("")} className="text-slate-400 hover:text-slate-600"><FaTimesCircle /></button>}
          </div>
        </div>
      </Panel>

      {/* tabela */}
      <Panel>
        {errorMsg && <div className="mb-4 rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm font-semibold text-rose-700">{errorMsg}</div>}
        {loading ? (
          <div className="py-16 text-center text-sm font-semibold text-slate-400">Carregando…</div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={<FaBoxOpen />} title="Nenhum registro encontrado" description="Registre uma nova saída para começar a rastrear." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs font-semibold uppercase tracking-widest text-slate-400">
                  <th className="pb-3 text-left pr-4">Nº</th>
                  <th className="pb-3 text-left pr-4">Status</th>
                  <th className="pb-3 text-left pr-4">Terceiro</th>
                  <th className="pb-3 text-left pr-4">Motivo</th>
                  <th className="pb-3 text-left pr-4">NF Saída</th>
                  <th className="pb-3 text-left pr-4">Data</th>
                  <th className="pb-3 text-left pr-4">Itens</th>
                  <th className="pb-3 text-center">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const meta = statusMeta(r.status);
                  return (
                    <tr
                      key={r.id}
                      className="border-b border-slate-50 hover:bg-slate-50/60 cursor-pointer"
                      onClick={() => setSelected(r)}
                    >
                      <td className="py-3 pr-4 font-semibold text-blue-700">{r.numero_saida}</td>
                      <td className="py-3 pr-4"><StatusChip tone={meta.tone}>{meta.label}</StatusChip></td>
                      <td className="py-3 pr-4 font-semibold">{r.terceiro_nome}</td>
                      <td className="py-3 pr-4 text-slate-600 max-w-[180px] truncate">{r.motivo}</td>
                      <td className="py-3 pr-4 text-slate-600">{r.nota_saida_numero || "—"}</td>
                      <td className="py-3 pr-4 text-slate-600">{formatDateBR(r.nota_saida_data)}</td>
                      <td className="py-3 pr-4 text-slate-600">{(r.itens || []).length}</td>
                      <td className="py-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1">
                          {r.status === "Em posse do terceiro" && (
                            <button onClick={() => setEditRecord(r)} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100" title="Editar">
                              <FaEdit />
                            </button>
                          )}
                          <button onClick={() => printFicha(r)} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100" title="Baixar PDF">
                            <FaDownload />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {showNovo && (
        <SaidaModal onClose={() => setShowNovo(false)} onSaved={() => { setShowNovo(false); carregar(); }} userInfo={userInfo} />
      )}
      {editRecord && (
        <SaidaModal editRecord={editRecord} onClose={() => setEditRecord(null)} onSaved={() => { setEditRecord(null); carregar(); }} userInfo={userInfo} />
      )}
      {selected && (
        <DetalheModal
          record={selected}
          onClose={() => setSelected(null)}
          onUpdated={() => { setSelected(null); carregar(); }}
          onEdit={(r) => setEditRecord(r)}
          userInfo={userInfo}
        />
      )}
    </div>
  );
}
