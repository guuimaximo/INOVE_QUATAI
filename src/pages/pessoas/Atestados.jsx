import { useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  FaCheckCircle,
  FaClock,
  FaExclamationTriangle,
  FaFileMedical,
  FaFilePdf,
  FaFileImage,
  FaFilter,
  FaPlus,
  FaSave,
  FaSearch,
  FaSync,
  FaTimes,
  FaUpload,
  FaUserInjured,
} from "react-icons/fa";

import { AuthContext } from "../../context/AuthContext";
import { supabase } from "../../supabase";
import { supabaseBCNT } from "../../supabaseBCNT";

const TIPOS_DOCUMENTO = [
  { value: "ATESTADO_MEDICO", label: "Atestado médico" },
  { value: "DECLARACAO_COMPARECIMENTO", label: "Declaração de comparecimento" },
  { value: "ATESTADO_ACOMPANHANTE", label: "Atestado de acompanhante" },
  { value: "OUTROS", label: "Outros (licenças, INSS)" },
];

const TIPO_LABEL = TIPOS_DOCUMENTO.reduce((acc, tipo) => {
  acc[tipo.value] = tipo.label;
  return acc;
}, {});

const STATUS_CONFIG = {
  AGUARDA_RH: { label: "Aguarda RH", chip: "bg-amber-100 text-amber-800 border-amber-200" },
  VALIDADO: { label: "Validado", chip: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  RECUSADO: { label: "Recusado", chip: "bg-rose-100 text-rose-800 border-rose-200" },
};

const STATUS_FILTROS = [
  { value: "todos", label: "Todos" },
  { value: "AGUARDA_RH", label: "Aguarda RH" },
  { value: "VALIDADO", label: "Validados" },
  { value: "RECUSADO", label: "Recusados" },
];

const RH_NIVEIS = new Set(["rh", "administrador", "admin"]);
const FIELD_INPUT =
  "rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100";

function normalizeText(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

function safeText(value) {
  return String(value || "").trim();
}

function sanitizeName(name) {
  return String(name || "arquivo")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9._-]/g, "");
}

function formatDateBR(value) {
  const text = safeText(value);
  if (!text) return "-";
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) {
    const [year, month, day] = text.slice(0, 10).split("-");
    return `${day}/${month}/${year}`;
  }
  return text;
}

function formatDateTimeBR(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function currentMonthKey() {
  return todayIso().slice(0, 7);
}

function diffDaysInclusive(start, end) {
  const s = safeText(start);
  const e = safeText(end);
  if (!s || !e) return null;
  const startMs = new Date(`${s}T00:00:00`).getTime();
  const endMs = new Date(`${e}T00:00:00`).getTime();
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs < startMs) return null;
  return Math.floor((endMs - startMs) / 86400000) + 1;
}

function formatDias(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "-";
  return Number.isInteger(num) ? String(num) : num.toFixed(1).replace(".", ",");
}

function isPdfUrl(url) {
  return /\.pdf(\?|#|$)/i.test(String(url || ""));
}

async function fetchAtestados() {
  const { data, error } = await supabase
    .from("atestados")
    .select("*")
    .order("criado_em", { ascending: false });
  if (error) throw error;
  return data || [];
}

async function fetchFuncionarios() {
  const pageSize = 1000;
  const rows = [];
  let start = 0;
  while (true) {
    const { data, error } = await supabaseBCNT
      .from("funcionarios_atualizada")
      .select("id_funcionario, nr_cracha, nm_funcionario, nm_funcao, status")
      .order("nm_funcionario", { ascending: true })
      .range(start, start + pageSize - 1);
    if (error) throw error;
    if (!data?.length) break;
    rows.push(...data);
    if (data.length < pageSize) break;
    start += pageSize;
  }
  return rows;
}

async function uploadArquivo(file) {
  const safe = sanitizeName(file?.name);
  const unique = `${Date.now()}_${Math.random().toString(16).slice(2)}_${safe}`;
  const path = `documentos/${unique}`;
  const up = await supabase.storage.from("atestados").upload(path, file, {
    upsert: false,
    contentType: file?.type || undefined,
  });
  if (up.error) throw up.error;
  const { data: pub } = supabase.storage.from("atestados").getPublicUrl(path);
  return { url: pub?.publicUrl || null, nome: file?.name || safe };
}

function CardKPI({ titulo, valor, sub, cor = "slate", icon }) {
  const styles = {
    slate: "border-slate-200 bg-slate-50 text-slate-900",
    blue: "border-blue-200 bg-blue-50 text-blue-900",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-900",
    rose: "border-rose-200 bg-rose-50 text-rose-900",
    amber: "border-amber-200 bg-amber-50 text-amber-900",
  };
  return (
    <div className={`rounded-2xl border px-4 py-3 ${styles[cor] || styles.slate}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-70">{titulo}</div>
        {icon ? <span className="text-base opacity-60">{icon}</span> : null}
      </div>
      <div className="mt-1 text-2xl font-black">{valor}</div>
      {sub ? <div className="mt-0.5 text-[11px] opacity-75">{sub}</div> : null}
    </div>
  );
}

function Field({ label, children, hint }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">{label}</span>
      {children}
      {hint ? <span className="text-[10px] text-slate-400">{hint}</span> : null}
    </label>
  );
}

function InfoBox({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">{label}</div>
      <div className="mt-1 text-sm font-semibold text-slate-800">{value || "-"}</div>
    </div>
  );
}

function StatusChip({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.AGUARDA_RH;
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${cfg.chip}`}>
      {cfg.label}
    </span>
  );
}

function AnexoPreview({ url }) {
  if (!url) return <span className="text-xs text-slate-400">Sem anexo</span>;
  const pdf = isPdfUrl(url);
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
      title="Abrir anexo"
      onClick={(event) => event.stopPropagation()}
    >
      {pdf ? <FaFilePdf className="text-rose-500" /> : <FaFileImage className="text-blue-500" />}
      {pdf ? "PDF" : "Imagem"}
    </a>
  );
}

function NovoAtestadoModal({ open, onClose, onSave, saving, funcionarios }) {
  const [buscaFunc, setBuscaFunc] = useState("");
  const [funcionario, setFuncionario] = useState(null);
  const [showLista, setShowLista] = useState(false);
  const [form, setForm] = useState({
    tipo_documento: "ATESTADO_MEDICO",
    data_inicio: todayIso(),
    data_fim: todayIso(),
    dias: "",
    cid: "",
    medico_emissor: "",
    observacao: "",
  });
  const [arquivo, setArquivo] = useState(null);
  const fileRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setBuscaFunc("");
    setFuncionario(null);
    setShowLista(false);
    setArquivo(null);
    setForm({
      tipo_documento: "ATESTADO_MEDICO",
      data_inicio: todayIso(),
      data_fim: todayIso(),
      dias: "",
      cid: "",
      medico_emissor: "",
      observacao: "",
    });
  }, [open]);

  const funcionariosFiltrados = useMemo(() => {
    const termo = normalizeText(buscaFunc);
    if (!termo) return funcionarios.slice(0, 30);
    return funcionarios
      .filter((f) =>
        normalizeText(`${f.nm_funcionario} ${f.nr_cracha} ${f.nm_funcao}`).includes(termo)
      )
      .slice(0, 30);
  }, [buscaFunc, funcionarios]);

  const diasSugeridos = diffDaysInclusive(form.data_inicio, form.data_fim);
  const diasFinal = form.dias !== "" ? Number(String(form.dias).replace(",", ".")) : diasSugeridos;

  if (!open) return null;

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function selecionarFuncionario(f) {
    setFuncionario(f);
    setBuscaFunc(`${f.nm_funcionario} — ${f.nr_cracha || "sem chapa"}`);
    setShowLista(false);
  }

  function handleSalvar() {
    if (!funcionario) {
      window.alert("Selecione o colaborador.");
      return;
    }
    if (!form.data_inicio) {
      window.alert("Informe a data de início.");
      return;
    }
    if (!arquivo) {
      window.alert("Anexe o arquivo do atestado ou declaração.");
      return;
    }
    onSave({
      funcionario,
      form: { ...form, dias: diasFinal ?? null },
      arquivo,
    });
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-[2px]">
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-200 bg-white/80 px-6 py-4">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-blue-600">Pessoas · Atestados</div>
            <div className="mt-1 text-xl font-black text-slate-900">Novo atestado</div>
            <div className="text-sm text-slate-500">Anexe o documento e envie para validação do RH.</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <FaTimes />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          <Field label="Colaborador" hint="Busque por nome, chapa ou função.">
            <div className="relative">
              <input
                className={`${FIELD_INPUT} w-full`}
                value={buscaFunc}
                placeholder="Buscar por nome ou chapa"
                onChange={(event) => {
                  setBuscaFunc(event.target.value);
                  setFuncionario(null);
                  setShowLista(true);
                }}
                onFocus={() => setShowLista(true)}
              />
              {showLista ? (
                <div className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
                  {funcionariosFiltrados.length ? (
                    funcionariosFiltrados.map((f) => (
                      <button
                        key={f.id_funcionario || f.nr_cracha || f.nm_funcionario}
                        type="button"
                        onClick={() => selecionarFuncionario(f)}
                        className="flex w-full flex-col border-b border-slate-100 px-3 py-2 text-left last:border-b-0 hover:bg-slate-50"
                      >
                        <span className="text-sm font-bold text-slate-900">{f.nm_funcionario}</span>
                        <span className="text-xs text-slate-500">
                          {f.nr_cracha ? `Chapa ${f.nr_cracha}` : "Sem chapa"}
                          {f.nm_funcao ? ` · ${f.nm_funcao}` : ""}
                        </span>
                      </button>
                    ))
                  ) : (
                    <div className="px-3 py-3 text-sm text-slate-400">Nenhum colaborador encontrado.</div>
                  )}
                </div>
              ) : null}
            </div>
          </Field>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label="Tipo de documento">
              <select
                className={FIELD_INPUT}
                value={form.tipo_documento}
                onChange={(event) => updateField("tipo_documento", event.target.value)}
              >
                {TIPOS_DOCUMENTO.map((tipo) => (
                  <option key={tipo.value} value={tipo.value}>
                    {tipo.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="CID (opcional)" hint="Ex.: J06. Só quando houver no documento.">
              <input
                className={FIELD_INPUT}
                value={form.cid}
                onChange={(event) => updateField("cid", event.target.value)}
                placeholder="Ex.: J06"
              />
            </Field>
            <Field label="Data início">
              <input
                className={FIELD_INPUT}
                type="date"
                value={form.data_inicio}
                onChange={(event) => updateField("data_inicio", event.target.value)}
              />
            </Field>
            <Field label="Data fim">
              <input
                className={FIELD_INPUT}
                type="date"
                value={form.data_fim}
                onChange={(event) => updateField("data_fim", event.target.value)}
              />
            </Field>
            <Field
              label="Dias"
              hint={
                diasSugeridos != null
                  ? `Sugerido pelo período: ${diasSugeridos} dia(s). Use 0,5 para meio período.`
                  : "Informe os dias (0,5 para meio período)."
              }
            >
              <input
                className={FIELD_INPUT}
                value={form.dias}
                inputMode="decimal"
                onChange={(event) => updateField("dias", event.target.value)}
                placeholder={diasSugeridos != null ? String(diasSugeridos) : "Ex.: 1 ou 0,5"}
              />
            </Field>
            <Field label="Médico / emissor (opcional)">
              <input
                className={FIELD_INPUT}
                value={form.medico_emissor}
                onChange={(event) => updateField("medico_emissor", event.target.value)}
                placeholder="Dr(a). / CRM / clínica"
              />
            </Field>
          </div>

          <Field label="Observação (opcional)">
            <textarea
              className={`${FIELD_INPUT} min-h-[80px] resize-y`}
              value={form.observacao}
              onChange={(event) => updateField("observacao", event.target.value)}
              placeholder="Alguma informação relevante para o RH."
            />
          </Field>

          <div>
            <div className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Anexo</div>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex w-full flex-col items-center gap-1 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500 transition hover:border-blue-300 hover:bg-blue-50/40"
            >
              <FaUpload className="text-xl text-slate-400" />
              {arquivo ? (
                <span className="font-semibold text-slate-700">{arquivo.name}</span>
              ) : (
                <span>Clique para anexar o PDF ou foto do atestado</span>
              )}
              <span className="text-[10px] text-slate-400">PDF ou imagem, até 30 MB.</span>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={(event) => setArquivo(event.target.files?.[0] || null)}
            />
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4 sm:flex-row sm:items-center sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-100"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={handleSalvar}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <FaSave />
            {saving ? "Salvando..." : "Enviar para o RH"}
          </button>
        </div>
      </div>
    </div>
  );
}

function DetalheModal({ item, open, onClose, onValidar, onRecusar, saving, podeValidar }) {
  const [motivo, setMotivo] = useState("");
  const [modoRecusa, setModoRecusa] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMotivo(item?.motivo_recusa || "");
    setModoRecusa(false);
  }, [open, item]);

  if (!open || !item) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-[2px]">
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-blue-600">Atestado</div>
            <div className="mt-1 text-xl font-black text-slate-900">{item.funcionario_nome}</div>
            <div className="text-sm text-slate-500">
              {item.funcionario_cracha ? `Chapa ${item.funcionario_cracha}` : "Sem chapa"}
              {item.funcionario_funcao ? ` · ${item.funcionario_funcao}` : ""}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <StatusChip status={item.status} />
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            >
              <FaTimes />
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <InfoBox label="Tipo" value={TIPO_LABEL[item.tipo_documento] || item.tipo_documento} />
            <InfoBox label="Dias" value={item.dias != null ? `${formatDias(item.dias)} dia(s)` : "-"} />
            <InfoBox
              label="Período"
              value={`${formatDateBR(item.data_inicio)}${item.data_fim ? ` a ${formatDateBR(item.data_fim)}` : ""}`}
            />
            <InfoBox label="CID" value={item.cid} />
            <InfoBox label="Médico / emissor" value={item.medico_emissor} />
            <InfoBox label="Anexo" value={<AnexoPreview url={item.arquivo_url} />} />
          </div>

          {item.observacao ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Observação do gestor</div>
              <div className="mt-1 text-sm text-slate-700">{item.observacao}</div>
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <InfoBox
              label="Lançado por"
              value={`${item.criado_por_nome || item.criado_por_login || "-"} · ${formatDateTimeBR(item.criado_em)}`}
            />
            <InfoBox
              label="Validação"
              value={
                item.status === "AGUARDA_RH"
                  ? "Aguardando RH"
                  : `${item.validado_por_nome || item.validado_por_login || "-"} · ${formatDateTimeBR(item.validado_em)}`
              }
            />
          </div>

          {item.status === "RECUSADO" && item.motivo_recusa ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3">
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-rose-500">Motivo da recusa</div>
              <div className="mt-1 text-sm text-rose-800">{item.motivo_recusa}</div>
            </div>
          ) : null}

          {podeValidar && modoRecusa ? (
            <Field label="Motivo da recusa" hint="Explique para o gestor o que precisa ser corrigido.">
              <textarea
                className={`${FIELD_INPUT} min-h-[80px] resize-y`}
                value={motivo}
                onChange={(event) => setMotivo(event.target.value)}
              />
            </Field>
          ) : null}
        </div>

        {podeValidar ? (
          <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4 sm:flex-row sm:items-center sm:justify-end">
            {modoRecusa ? (
              <>
                <button
                  type="button"
                  onClick={() => setModoRecusa(false)}
                  className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-100"
                >
                  Voltar
                </button>
                <button
                  type="button"
                  disabled={saving || !safeText(motivo)}
                  onClick={() => onRecusar(item, safeText(motivo))}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <FaExclamationTriangle />
                  Confirmar recusa
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setModoRecusa(true)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-200 bg-white px-4 py-2 text-sm font-bold text-rose-700 transition hover:bg-rose-50"
                >
                  <FaTimes />
                  Recusar
                </button>
                <button
                  type="button"
                  disabled={saving || item.status === "VALIDADO"}
                  onClick={() => onValidar(item)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <FaCheckCircle />
                  {item.status === "VALIDADO" ? "Já validado" : "Validar"}
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="border-t border-slate-200 bg-slate-50 px-6 py-4 text-right">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-100"
            >
              Fechar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Atestados() {
  const { user } = useContext(AuthContext);
  const podeValidar = RH_NIVEIS.has(normalizeText(user?.nivel));

  const [atestados, setAtestados] = useState([]);
  const [funcionarios, setFuncionarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [saving, setSaving] = useState(false);

  const [busca, setBusca] = useState("");
  const [tipoFiltro, setTipoFiltro] = useState("todos");
  const [statusFiltro, setStatusFiltro] = useState("todos");
  const [mesFiltro, setMesFiltro] = useState("");

  const [novoOpen, setNovoOpen] = useState(false);
  const [detalhe, setDetalhe] = useState(null);

  async function carregar() {
    setLoading(true);
    setErro("");
    try {
      const [lista, funcs] = await Promise.all([fetchAtestados(), fetchFuncionarios()]);
      setAtestados(lista);
      setFuncionarios(funcs);
    } catch (error) {
      console.error(error);
      setErro(error.message || "Falha ao carregar atestados.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtrados = useMemo(() => {
    const termo = normalizeText(busca);
    return atestados.filter((item) => {
      if (tipoFiltro !== "todos" && item.tipo_documento !== tipoFiltro) return false;
      if (statusFiltro !== "todos" && item.status !== statusFiltro) return false;
      if (mesFiltro && String(item.data_inicio || "").slice(0, 7) !== mesFiltro) return false;
      if (
        termo &&
        !normalizeText(`${item.funcionario_nome} ${item.funcionario_cracha} ${item.funcionario_funcao}`).includes(termo)
      ) {
        return false;
      }
      return true;
    });
  }, [atestados, busca, tipoFiltro, statusFiltro, mesFiltro]);

  const kpis = useMemo(() => {
    const mesAtual = currentMonthKey();
    const hoje = todayIso();
    let doMes = 0;
    let afastadosHoje = 0;
    let diasMes = 0;
    let aguardando = 0;
    for (const item of atestados) {
      const inicioMes = String(item.data_inicio || "").slice(0, 7);
      if (inicioMes === mesAtual) {
        doMes += 1;
        diasMes += Number(item.dias || 0);
      }
      if (item.status !== "RECUSADO") {
        const inicio = safeText(item.data_inicio);
        const fim = safeText(item.data_fim) || inicio;
        if (inicio && inicio <= hoje && fim >= hoje) afastadosHoje += 1;
      }
      if (item.status === "AGUARDA_RH") aguardando += 1;
    }
    return { doMes, afastadosHoje, diasMes, aguardando };
  }, [atestados]);

  async function handleSalvarNovo({ funcionario, form, arquivo }) {
    setSaving(true);
    try {
      const anexo = await uploadArquivo(arquivo);
      const payload = {
        funcionario_id: funcionario.id_funcionario || null,
        funcionario_cracha: funcionario.nr_cracha || null,
        funcionario_nome: funcionario.nm_funcionario || null,
        funcionario_funcao: funcionario.nm_funcao || null,
        tipo_documento: form.tipo_documento,
        data_inicio: form.data_inicio || null,
        data_fim: form.data_fim || null,
        dias: form.dias != null && form.dias !== "" ? Number(form.dias) : null,
        cid: safeText(form.cid) || null,
        medico_emissor: safeText(form.medico_emissor) || null,
        observacao: safeText(form.observacao) || null,
        arquivo_url: anexo.url,
        arquivo_nome: anexo.nome,
        status: "AGUARDA_RH",
        criado_por_login: user?.login || null,
        criado_por_nome: user?.nome || null,
        criado_em: new Date().toISOString(),
        atualizado_em: new Date().toISOString(),
      };
      const { error } = await supabase.from("atestados").insert(payload);
      if (error) throw error;
      setNovoOpen(false);
      await carregar();
    } catch (error) {
      console.error(error);
      window.alert(`Falha ao salvar atestado: ${error.message || error}`);
    } finally {
      setSaving(false);
    }
  }

  async function atualizarStatus(item, novoStatus, motivo) {
    setSaving(true);
    try {
      const payload = {
        status: novoStatus,
        motivo_recusa: novoStatus === "RECUSADO" ? motivo || null : null,
        validado_por_login: user?.login || null,
        validado_por_nome: user?.nome || null,
        validado_em: new Date().toISOString(),
        atualizado_em: new Date().toISOString(),
      };
      const { error } = await supabase.from("atestados").update(payload).eq("id", item.id);
      if (error) throw error;
      setDetalhe(null);
      await carregar();
    } catch (error) {
      console.error(error);
      window.alert(`Falha ao atualizar atestado: ${error.message || error}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2 text-2xl font-black text-slate-900">
            <FaFileMedical className="text-blue-600" />
            Atestados e declarações
          </div>
          <div className="mt-1 text-sm text-slate-500">
            O gestor lança os documentos e o RH valida. {podeValidar ? "Você pode validar/recusar." : "Validação é feita pelo RH."}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={carregar}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            <FaSync className={loading ? "animate-spin" : ""} />
            Atualizar
          </button>
          <button
            type="button"
            onClick={() => setNovoOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-700"
          >
            <FaPlus />
            Novo atestado
          </button>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <CardKPI titulo="Este mês" valor={kpis.doMes} cor="blue" icon={<FaFileMedical />} />
        <CardKPI titulo="Afastados hoje" valor={kpis.afastadosHoje} cor="amber" icon={<FaUserInjured />} />
        <CardKPI titulo="Dias no mês" valor={formatDias(kpis.diasMes)} cor="slate" icon={<FaClock />} />
        <CardKPI titulo="Aguardando RH" valor={kpis.aguardando} cor="rose" icon={<FaExclamationTriangle />} />
      </div>

      <div className="mt-5 flex flex-col gap-2 md:flex-row md:items-center">
        <div className="flex flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
          <FaSearch className="text-slate-400" />
          <input
            className="w-full text-sm text-slate-700 outline-none"
            placeholder="Buscar por nome ou chapa"
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-slate-400">
            <FaFilter />
          </span>
          <select className={FIELD_INPUT} value={tipoFiltro} onChange={(event) => setTipoFiltro(event.target.value)}>
            <option value="todos">Todos os tipos</option>
            {TIPOS_DOCUMENTO.map((tipo) => (
              <option key={tipo.value} value={tipo.value}>
                {tipo.label}
              </option>
            ))}
          </select>
          <select className={FIELD_INPUT} value={statusFiltro} onChange={(event) => setStatusFiltro(event.target.value)}>
            {STATUS_FILTROS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <input
            className={FIELD_INPUT}
            type="month"
            value={mesFiltro}
            onChange={(event) => setMesFiltro(event.target.value)}
          />
        </div>
      </div>

      {erro ? (
        <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
          {erro}
        </div>
      ) : null}

      <div className="mt-5 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead>
              <tr className="text-left text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">
                <th className="px-4 py-3">Colaborador</th>
                <th className="px-4 py-3">Tipo · período</th>
                <th className="px-4 py-3">Dias</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Anexo</th>
                <th className="px-4 py-3">Lançado por</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                    Carregando...
                  </td>
                </tr>
              ) : filtrados.length ? (
                filtrados.map((item) => (
                  <tr
                    key={item.id}
                    className="cursor-pointer hover:bg-slate-50/70"
                    onClick={() => setDetalhe(item)}
                  >
                    <td className="px-4 py-3">
                      <div className="font-bold text-slate-900">{item.funcionario_nome || "-"}</div>
                      <div className="text-xs text-slate-500">
                        {item.funcionario_cracha ? `Chapa ${item.funcionario_cracha}` : "Sem chapa"}
                        {item.funcionario_funcao ? ` · ${item.funcionario_funcao}` : ""}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-slate-800">{TIPO_LABEL[item.tipo_documento] || item.tipo_documento}</div>
                      <div className="text-xs text-slate-500">
                        {formatDateBR(item.data_inicio)}
                        {item.data_fim && item.data_fim !== item.data_inicio ? ` a ${formatDateBR(item.data_fim)}` : ""}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{item.dias != null ? formatDias(item.dias) : "-"}</td>
                    <td className="px-4 py-3">
                      <StatusChip status={item.status} />
                    </td>
                    <td className="px-4 py-3">
                      <AnexoPreview url={item.arquivo_url} />
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      <div className="font-semibold text-slate-700">{item.criado_por_nome || item.criado_por_login || "-"}</div>
                      <div>{formatDateTimeBR(item.criado_em)}</div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                    Nenhum atestado encontrado. Clique em "Novo atestado" para lançar o primeiro.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <NovoAtestadoModal
        open={novoOpen}
        onClose={() => setNovoOpen(false)}
        onSave={handleSalvarNovo}
        saving={saving}
        funcionarios={funcionarios}
      />

      <DetalheModal
        item={detalhe}
        open={Boolean(detalhe)}
        onClose={() => setDetalhe(null)}
        onValidar={(item) => atualizarStatus(item, "VALIDADO")}
        onRecusar={(item, motivo) => atualizarStatus(item, "RECUSADO", motivo)}
        saving={saving}
        podeValidar={podeValidar}
      />
    </div>
  );
}
