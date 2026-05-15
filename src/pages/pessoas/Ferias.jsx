import { useContext, useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import {
  FaCalendarAlt,
  FaCheckCircle,
  FaClock,
  FaDownload,
  FaExclamationTriangle,
  FaFilter,
  FaSave,
  FaSearch,
  FaSync,
  FaTimes,
  FaUpload,
  FaUserClock,
  FaUsers,
} from "react-icons/fa";

import { AuthContext } from "../../context/AuthContext";
import { supabase } from "../../supabase";

const CACHE_PERIODOS_KEY = "inove_ferias_periodos_cache_v1";
const CACHE_PLANOS_KEY = "inove_ferias_planos_cache_v1";

const STATUS_VIEW = [
  { value: "todos", label: "Todos" },
  { value: "criticos", label: "Criticos" },
  { value: "em_gozo", label: "Em ferias" },
  { value: "programado", label: "Programados" },
  { value: "saldo", label: "Saldo pendente" },
  { value: "quitado", label: "Quitados" },
];

const STATUS_PLANEJAMENTO = [
  { value: "ANALISAR", label: "Gestor analisando" },
  { value: "PODE_PROGRAMAR", label: "Pode programar" },
  { value: "PROGRAMADO", label: "Programado" },
  { value: "EM_GOZO", label: "Em gozo" },
  { value: "BLOQUEADO_OPERACAO", label: "Segurar operacao" },
  { value: "CONCLUIDO", label: "Concluido" },
];

const PRIORIDADES = [
  { value: "ALTA", label: "Alta" },
  { value: "MEDIA", label: "Media" },
  { value: "BAIXA", label: "Baixa" },
];

const FIELD_INPUT =
  "rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100";

function normalizeText(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function safeText(value) {
  return String(value || "").trim();
}

function parseNullableInt(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number.parseInt(String(value).replace(/[^\d-]/g, ""), 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function parseSimNao(value) {
  return normalizeText(value) === "sim";
}

function parseDateInput(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  const text = safeText(value);
  if (!text) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(text)) {
    const [day, month, year] = text.split("/");
    return `${year}-${month}-${day}`;
  }
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function formatDateBR(value) {
  const parsed = parseDateInput(value);
  if (!parsed) return "-";
  const [year, month, day] = parsed.split("-");
  return `${day}/${month}/${year}`;
}

function formatDateTimeBR(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

function formatInt(value) {
  return Number(value || 0).toLocaleString("pt-BR");
}

function buildFuncionarioKey(value) {
  return String(
    value?.funcionario_id ||
      value?.id_funcionario ||
      value?.funcionario_cracha ||
      value?.nr_cracha ||
      normalizeText(value?.nm_funcionario || value?.nome) ||
      ""
  );
}

function diffDaysInclusive(start, end) {
  const startDate = parseDateInput(start);
  const endDate = parseDateInput(end);
  if (!startDate || !endDate) return null;
  const startMs = new Date(`${startDate}T00:00:00`).getTime();
  const endMs = new Date(`${endDate}T00:00:00`).getTime();
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs < startMs) return null;
  return Math.floor((endMs - startMs) / 86400000) + 1;
}

function buildCsvRowPayload(row, meta) {
  return {
    ferias_id: safeText(row.id_ferias),
    funcionario_id: safeText(row.id_funcionario),
    nr_cracha: safeText(row.nr_cracha),
    nm_funcionario: safeText(row.nm_funcionario),
    nm_funcao: safeText(row.nm_funcao),
    dt_inicio_aquisitivo: parseDateInput(row.dt_inicio_aquisitivo),
    dt_fim_aquisitivo: parseDateInput(row.dt_fim_aquisitivo),
    dt_alerta_11_meses: parseDateInput(row.dt_alerta_11_meses),
    dt_limite_legal: parseDateInput(row.dt_limite_legal),
    dias_para_limite_legal: parseNullableInt(row.dias_para_limite_legal),
    qt_dias_ferias: parseNullableInt(row.qt_dias_ferias),
    dias_realizados: parseNullableInt(row.dias_realizados),
    dias_em_andamento: parseNullableInt(row.dias_em_andamento),
    dias_agendados: parseNullableInt(row.dias_agendados),
    dias_total_programado: parseNullableInt(row.dias_total_programado),
    dias_pendentes_total: parseNullableInt(row.dias_pendentes_total),
    dias_pendentes_realizados: parseNullableInt(row.dias_pendentes_realizados),
    status_periodo: safeText(row.status_periodo),
    possui_saldo_pendente: parseSimNao(row.possui_saldo_pendente),
    status_realizacao: safeText(row.status_realizacao),
    status_agendamento: safeText(row.status_agendamento),
    qtd_periodos_gozo: parseNullableInt(row.qtd_periodos_gozo),
    qtd_gozos_realizados: parseNullableInt(row.qtd_gozos_realizados),
    qtd_gozos_em_andamento: parseNullableInt(row.qtd_gozos_em_andamento),
    qtd_gozos_agendados: parseNullableInt(row.qtd_gozos_agendados),
    ultimo_inicio_gozo_realizado: parseDateInput(row.ultimo_inicio_gozo_realizado),
    ultimo_fim_gozo_realizado: parseDateInput(row.ultimo_fim_gozo_realizado),
    proximo_inicio_gozo: parseDateInput(row.proximo_inicio_gozo),
    proximo_fim_gozo: parseDateInput(row.proximo_fim_gozo),
    cs_situacao_ferias: safeText(row.cs_situacao_ferias),
    nr_faltas: parseNullableInt(row.nr_faltas),
    historico_gozos: safeText(row.historico_gozos),
    ativo: true,
    arquivo_lote: meta.loteId,
    fonte_arquivo: meta.fileName,
    importado_por_login: meta.login,
    importado_por_nome: meta.nome,
    importado_em: meta.timestamp,
    atualizado_em: meta.timestamp,
  };
}

function deriveResumoStatus(item) {
  const hoje = parseDateInput(new Date());
  const saldo = Number(item.dias_pendentes_total || 0);
  const emGozo =
    Number(item.dias_em_andamento || 0) > 0 ||
    normalizeText(item.status_periodo).includes("em_gozo") ||
    item.status_planejamento === "EM_GOZO";
  const programado =
    (!!item.programado_inicio && !!item.programado_fim) ||
    (!!item.proximo_inicio_gozo && !!item.proximo_fim_gozo) ||
    Number(item.dias_agendados || 0) > 0 ||
    item.status_planejamento === "PROGRAMADO";
  const limiteLegal = parseDateInput(item.dt_limite_legal);
  const alerta11Meses = parseDateInput(item.dt_alerta_11_meses);
  const vencido = !!saldo && !!limiteLegal && !!hoje && limiteLegal < hoje;
  const alerta = !!saldo && !!alerta11Meses && !!hoje && alerta11Meses <= hoje && !vencido;

  if (item.status_planejamento === "BLOQUEADO_OPERACAO") {
    return {
      key: "bloqueado",
      label: "Segurar operacao",
      chip: "bg-amber-100 text-amber-800 border-amber-200",
      order: 2,
    };
  }
  if (vencido) {
    return {
      key: "vencido",
      label: "Ferias vencidas",
      chip: "bg-rose-100 text-rose-800 border-rose-200",
      order: 0,
    };
  }
  if (emGozo) {
    return {
      key: "em_gozo",
      label: "Em ferias",
      chip: "bg-purple-100 text-purple-800 border-purple-200",
      order: 1,
    };
  }
  if (programado) {
    return {
      key: "programado",
      label: "Programado",
      chip: "bg-emerald-100 text-emerald-800 border-emerald-200",
      order: 3,
    };
  }
  if (alerta) {
    return {
      key: "alerta",
      label: "Atenção 11 meses",
      chip: "bg-amber-100 text-amber-800 border-amber-200",
      order: 4,
    };
  }
  if (saldo > 0) {
    return {
      key: "saldo",
      label: "Saldo pendente",
      chip: "bg-blue-100 text-blue-800 border-blue-200",
      order: 5,
    };
  }
  return {
    key: "quitado",
    label: "Quitado",
    chip: "bg-slate-100 text-slate-700 border-slate-200",
    order: 6,
  };
}

function exportarCSV(rows) {
  if (!rows.length) {
    window.alert("Nao ha dados para exportar.");
    return;
  }
  const header = [
    "Colaborador",
    "Cracha",
    "Funcao",
    "Area",
    "Periodo aquisitivo",
    "Limite legal",
    "Dias pendentes",
    "Status",
    "Quando pode tirar",
    "Quando vai tirar",
    "Planejamento",
    "Prioridade",
  ];
  const lines = rows.map((row) => [
    row.nm_funcionario || "",
    row.nr_cracha || "",
    row.nm_funcao || "",
    row.area_titulo || "",
    `${formatDateBR(row.dt_inicio_aquisitivo)} a ${formatDateBR(row.dt_fim_aquisitivo)}`,
    formatDateBR(row.dt_limite_legal),
    row.dias_pendentes_total || 0,
    row.resumo_status_label,
    row.janela_sugerida_inicio || row.janela_sugerida_fim
      ? `${formatDateBR(row.janela_sugerida_inicio)} a ${formatDateBR(row.janela_sugerida_fim)}`
      : "",
    row.programado_inicio || row.programado_fim
      ? `${formatDateBR(row.programado_inicio)} a ${formatDateBR(row.programado_fim)}`
      : "",
    row.status_planejamento || "",
    row.prioridade || "",
  ]);
  const csv = [header, ...lines]
    .map((line) => line.map((cell) => `"${String(cell || "").replace(/"/g, '""')}"`).join(";"))
    .join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `ferias_gestao_${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function CardKPI({ titulo, valor, sub, cor = "slate", icon }) {
  const styles = {
    slate: "border-slate-200 bg-slate-50 text-slate-900",
    blue: "border-blue-200 bg-blue-50 text-blue-900",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-900",
    rose: "border-rose-200 bg-rose-50 text-rose-900",
    amber: "border-amber-200 bg-amber-50 text-amber-900",
    purple: "border-purple-200 bg-purple-50 text-purple-900",
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

function PlanejamentoModal({ item, open, onClose, onSave, saving }) {
  const [form, setForm] = useState({
    janela_sugerida_inicio: "",
    janela_sugerida_fim: "",
    programado_inicio: "",
    programado_fim: "",
    status_planejamento: "ANALISAR",
    prioridade: "MEDIA",
    observacoes: "",
  });

  useEffect(() => {
    if (!open || !item) return;
    setForm({
      janela_sugerida_inicio: item.janela_sugerida_inicio || "",
      janela_sugerida_fim: item.janela_sugerida_fim || "",
      programado_inicio: item.programado_inicio || item.proximo_inicio_gozo || "",
      programado_fim: item.programado_fim || item.proximo_fim_gozo || "",
      status_planejamento: item.status_planejamento || (item.resumo_status_key === "vencido" ? "PODE_PROGRAMAR" : "ANALISAR"),
      prioridade: item.prioridade || (item.resumo_status_key === "vencido" ? "ALTA" : "MEDIA"),
      observacoes: item.observacoes || "",
    });
  }, [item, open]);

  if (!open || !item) return null;

  const diasPlanejados = diffDaysInclusive(form.programado_inicio, form.programado_fim);
  const saldoPendente = Number(item.dias_pendentes_total || 0);
  const mismatchDias = diasPlanejados !== null && saldoPendente > 0 && diasPlanejados !== saldoPendente;

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/60 p-4">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-blue-600">Planejamento de ferias</div>
            <div className="mt-1 text-xl font-black text-slate-900">{item.nm_funcionario}</div>
            <div className="text-sm text-slate-500">
              {item.nm_funcao || "Sem funcao"}{item.area_titulo ? ` • ${item.area_titulo}` : ""}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <FaTimes />
          </button>
        </div>

        <div className="grid flex-1 grid-cols-1 gap-5 overflow-y-auto px-6 py-5 lg:grid-cols-[1.1fr_1.3fr]">
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <InfoBox label="Cracha" value={item.nr_cracha} />
              <InfoBox label="Status atual" value={item.resumo_status_label} />
              <InfoBox
                label="Periodo aquisitivo"
                value={`${formatDateBR(item.dt_inicio_aquisitivo)} a ${formatDateBR(item.dt_fim_aquisitivo)}`}
              />
              <InfoBox label="Limite legal" value={formatDateBR(item.dt_limite_legal)} />
              <InfoBox label="Dias pendentes" value={formatInt(item.dias_pendentes_total)} />
              <InfoBox label="Em andamento" value={formatInt(item.dias_em_andamento)} />
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm font-black uppercase tracking-wide text-slate-700">Leitura do periodo</div>
              <div className="mt-3 space-y-2 text-sm text-slate-600">
                <p>
                  <span className="font-semibold text-slate-800">Alerta 11 meses:</span>{" "}
                  {formatDateBR(item.dt_alerta_11_meses)}
                </p>
                <p>
                  <span className="font-semibold text-slate-800">Ultimo gozo realizado:</span>{" "}
                  {item.ultimo_inicio_gozo_realizado
                    ? `${formatDateBR(item.ultimo_inicio_gozo_realizado)} a ${formatDateBR(item.ultimo_fim_gozo_realizado)}`
                    : "Sem registro"}
                </p>
                <p>
                  <span className="font-semibold text-slate-800">Proximo gozo no arquivo:</span>{" "}
                  {item.proximo_inicio_gozo
                    ? `${formatDateBR(item.proximo_inicio_gozo)} a ${formatDateBR(item.proximo_fim_gozo)}`
                    : "Nao agendado"}
                </p>
                <p>
                  <span className="font-semibold text-slate-800">Historico:</span>{" "}
                  {item.historico_gozos || "Sem historico no arquivo"}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
              <div className="text-sm font-black uppercase tracking-wide text-blue-900">Decisao do gestor</div>
              <div className="mt-2 text-sm text-blue-900/80">
                Primeiro registre quando a equipe consegue liberar. Depois defina o periodo real e o status da combinacao.
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Quando pode tirar - inicio">
                <input
                  className={FIELD_INPUT}
                  type="date"
                  value={form.janela_sugerida_inicio}
                  onChange={(event) => updateField("janela_sugerida_inicio", event.target.value)}
                />
              </Field>
              <Field label="Quando pode tirar - fim">
                <input
                  className={FIELD_INPUT}
                  type="date"
                  value={form.janela_sugerida_fim}
                  onChange={(event) => updateField("janela_sugerida_fim", event.target.value)}
                />
              </Field>
              <Field label="Vai tirar - inicio">
                <input
                  className={FIELD_INPUT}
                  type="date"
                  value={form.programado_inicio}
                  onChange={(event) => updateField("programado_inicio", event.target.value)}
                />
              </Field>
              <Field label="Vai tirar - fim">
                <input
                  className={FIELD_INPUT}
                  type="date"
                  value={form.programado_fim}
                  onChange={(event) => updateField("programado_fim", event.target.value)}
                />
              </Field>
              <Field label="Status do planejamento">
                <select
                  className={FIELD_INPUT}
                  value={form.status_planejamento}
                  onChange={(event) => updateField("status_planejamento", event.target.value)}
                >
                  {STATUS_PLANEJAMENTO.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Prioridade">
                <select
                  className={FIELD_INPUT}
                  value={form.prioridade}
                  onChange={(event) => updateField("prioridade", event.target.value)}
                >
                  {PRIORIDADES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            {item.proximo_inicio_gozo ? (
              <button
                type="button"
                onClick={() =>
                  setForm((current) => ({
                    ...current,
                    programado_inicio: item.proximo_inicio_gozo || "",
                    programado_fim: item.proximo_fim_gozo || "",
                  }))
                }
                className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100"
              >
                <FaCalendarAlt />
                Usar agenda que veio no arquivo
              </button>
            ) : null}

            <Field
              label="Observacoes do gestor"
              hint="Ex.: aguardar cobertura da equipe, ferias alinhadas com esposa, janela melhor em julho."
            >
              <textarea
                className={`${FIELD_INPUT} min-h-[120px] resize-y`}
                value={form.observacoes}
                onChange={(event) => updateField("observacoes", event.target.value)}
              />
            </Field>

            <div className={`rounded-2xl border p-4 ${mismatchDias ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-slate-50"}`}>
              <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">Checagem rapida</div>
              <div className="mt-2 text-sm text-slate-700">
                {diasPlanejados !== null
                  ? `O periodo escolhido soma ${diasPlanejados} dia(s).`
                  : "Preencha inicio e fim para validar o periodo real de ferias."}
              </div>
              {mismatchDias ? (
                <div className="mt-2 text-sm font-semibold text-amber-800">
                  O saldo pendente deste periodo esta em {saldoPendente} dia(s). Vale conferir se o planejamento bate com o saldo.
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4 sm:flex-row sm:items-center sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-100"
          >
            Fechar
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => onSave(form)}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <FaSave />
            {saving ? "Salvando..." : "Salvar planejamento"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Ferias() {
  const { user } = useContext(AuthContext);
  const fileInputRef = useRef(null);

  const [registros, setRegistros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fallbackMode, setFallbackMode] = useState(false);
  const [importing, setImporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busca, setBusca] = useState("");
  const [statusView, setStatusView] = useState("criticos");
  const [areaFiltro, setAreaFiltro] = useState("");
  const [funcaoFiltro, setFuncaoFiltro] = useState("");
  const [selecionado, setSelecionado] = useState(null);

  async function carregarDados() {
    setLoading(true);

    const [periodosResp, planosResp, pessoasResp, areasResp] = await Promise.all([
      supabase.from("ferias_periodos_importados").select("*").eq("ativo", true).order("dias_para_limite_legal", { ascending: true }),
      supabase.from("ferias_planejamento").select("*").order("atualizado_em", { ascending: false }),
      supabase
        .from("organograma_manutencao_pessoas")
        .select("funcionario_id, funcionario_cracha, nome, area_codigo, ativo, tipo_headcount")
        .eq("ativo", true)
        .eq("tipo_headcount", "REALIZADO"),
      supabase.from("organograma_manutencao_areas").select("codigo, titulo").eq("ativo", true),
    ]);

    const relationMissing =
      [periodosResp.error, planosResp.error].some(
        (error) => error?.code === "42P01" || String(error?.message || "").toLowerCase().includes("does not exist")
      );

    if (relationMissing) {
      const cachedPeriodos = JSON.parse(localStorage.getItem(CACHE_PERIODOS_KEY) || "[]");
      const cachedPlanos = JSON.parse(localStorage.getItem(CACHE_PLANOS_KEY) || "[]");
      const areaByCodigo = new Map((areasResp.data || []).map((area) => [area.codigo, area]));
      const allocByKey = new Map();
      for (const pessoa of pessoasResp.data || []) {
        const key = buildFuncionarioKey(pessoa);
        if (key) allocByKey.set(key, pessoa);
      }
      setFallbackMode(true);
      setRegistros(mergeFeriasData(cachedPeriodos, cachedPlanos, allocByKey, areaByCodigo));
      setLoading(false);
      return;
    }

    if (periodosResp.error) console.error(periodosResp.error);
    if (planosResp.error) console.error(planosResp.error);
    if (pessoasResp.error) console.error(pessoasResp.error);
    if (areasResp.error) console.error(areasResp.error);

    const areaByCodigo = new Map((areasResp.data || []).map((area) => [area.codigo, area]));
    const allocByKey = new Map();
    for (const pessoa of pessoasResp.data || []) {
      const key = buildFuncionarioKey(pessoa);
      if (key) allocByKey.set(key, pessoa);
    }

    setFallbackMode(false);
    setRegistros(mergeFeriasData(periodosResp.data || [], planosResp.data || [], allocByKey, areaByCodigo));
    setLoading(false);
  }

  useEffect(() => {
    carregarDados();
  }, []);

  async function handleImportFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
      const loteId = `ferias_${Date.now()}`;
      const timestamp = new Date().toISOString();
      const mappedRows = rawRows
        .map((row) =>
          buildCsvRowPayload(row, {
            loteId,
            fileName: file.name,
            login: user?.login || null,
            nome: user?.nome || null,
            timestamp,
          })
        )
        .filter((row) => row.ferias_id && row.nm_funcionario);

      if (!mappedRows.length) {
        window.alert("Nao encontrei linhas validas no arquivo enviado.");
        return;
      }

      if (fallbackMode) {
        localStorage.setItem(CACHE_PERIODOS_KEY, JSON.stringify(mappedRows));
        await carregarDados();
        window.alert("Base de ferias atualizada em cache local. Assim que a tabela existir no banco, essa base pode ser publicada para todos.");
        return;
      }

      const batchSize = 250;
      for (let start = 0; start < mappedRows.length; start += batchSize) {
        const batch = mappedRows.slice(start, start + batchSize);
        const { error } = await supabase
          .from("ferias_periodos_importados")
          .upsert(batch, { onConflict: "ferias_id" });
        if (error) throw error;
      }

      const { error: deactivateError } = await supabase
        .from("ferias_periodos_importados")
        .update({ ativo: false, atualizado_em: timestamp })
        .neq("arquivo_lote", loteId);

      if (deactivateError) throw deactivateError;

      await carregarDados();
      window.alert(`Base de ferias atualizada com ${mappedRows.length} periodo(s).`);
    } catch (error) {
      console.error(error);
      window.alert(`Falha ao importar a base de ferias: ${error.message || error}`);
    } finally {
      setImporting(false);
      if (event.target) event.target.value = "";
    }
  }

  async function handleSalvarPlanejamento(form) {
    if (!selecionado) return;

    const payload = {
      ferias_id: selecionado.ferias_id,
      funcionario_id: selecionado.funcionario_id || null,
      funcionario_cracha: selecionado.nr_cracha || null,
      nome: selecionado.nm_funcionario || null,
      funcao: selecionado.nm_funcao || null,
      area_codigo: selecionado.area_codigo || null,
      area_titulo: selecionado.area_titulo || null,
      janela_sugerida_inicio: form.janela_sugerida_inicio || null,
      janela_sugerida_fim: form.janela_sugerida_fim || null,
      programado_inicio: form.programado_inicio || null,
      programado_fim: form.programado_fim || null,
      status_planejamento: form.status_planejamento || "ANALISAR",
      prioridade: form.prioridade || "MEDIA",
      observacoes: safeText(form.observacoes) || null,
      atualizado_por_login: user?.login || null,
      atualizado_por_nome: user?.nome || null,
      atualizado_por_id: user?.usuario_id || user?.id || null,
      atualizado_em: new Date().toISOString(),
    };

    setSaving(true);
    try {
      if (fallbackMode) {
        const current = JSON.parse(localStorage.getItem(CACHE_PLANOS_KEY) || "[]");
        const next = [...current.filter((item) => String(item.ferias_id) !== String(payload.ferias_id))];
        next.unshift({
          ...current.find((item) => String(item.ferias_id) === String(payload.ferias_id)),
          ...payload,
        });
        localStorage.setItem(CACHE_PLANOS_KEY, JSON.stringify(next));
        await carregarDados();
        setSelecionado(null);
        return;
      }

      const existing = registros.find((row) => String(row.ferias_id) === String(payload.ferias_id));
      const { error } = await supabase.from("ferias_planejamento").upsert(
        {
          ...payload,
          criado_por_login: existing?.criado_por_login || user?.login || null,
          criado_por_nome: existing?.criado_por_nome || user?.nome || null,
          criado_por_id: existing?.criado_por_id || user?.usuario_id || user?.id || null,
        },
        { onConflict: "ferias_id" }
      );
      if (error) throw error;
      await carregarDados();
      setSelecionado(null);
    } catch (error) {
      console.error(error);
      window.alert(`Falha ao salvar o planejamento: ${error.message || error}`);
    } finally {
      setSaving(false);
    }
  }

  const areasOptions = useMemo(() => {
    const unique = new Set();
    for (const registro of registros) {
      if (registro.area_titulo) unique.add(registro.area_titulo);
    }
    return Array.from(unique).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [registros]);

  const funcoesOptions = useMemo(() => {
    const unique = new Set();
    for (const registro of registros) {
      if (registro.nm_funcao) unique.add(registro.nm_funcao);
    }
    return Array.from(unique).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [registros]);

  const filtrados = useMemo(() => {
    const query = normalizeText(busca);
    return registros
      .filter((registro) => {
        if (areaFiltro && registro.area_titulo !== areaFiltro) return false;
        if (funcaoFiltro && registro.nm_funcao !== funcaoFiltro) return false;
        if (statusView === "criticos" && !["vencido", "alerta", "bloqueado"].includes(registro.resumo_status_key)) return false;
        if (statusView === "em_gozo" && registro.resumo_status_key !== "em_gozo") return false;
        if (statusView === "programado" && registro.resumo_status_key !== "programado") return false;
        if (statusView === "saldo" && !["saldo", "alerta", "vencido", "bloqueado"].includes(registro.resumo_status_key)) return false;
        if (statusView === "quitado" && registro.resumo_status_key !== "quitado") return false;
        if (!query) return true;
        const blob = normalizeText(
          `${registro.nm_funcionario} ${registro.nr_cracha} ${registro.nm_funcao} ${registro.area_titulo} ${registro.historico_gozos}`
        );
        return blob.includes(query);
      })
      .sort((left, right) => {
        if (left.resumo_status_order !== right.resumo_status_order) {
          return left.resumo_status_order - right.resumo_status_order;
        }
        return Number(left.dias_para_limite_legal || 99999) - Number(right.dias_para_limite_legal || 99999);
      });
  }, [areaFiltro, busca, funcaoFiltro, registros, statusView]);

  const stats = useMemo(() => {
    const colaboradores = new Set(registros.map((registro) => `${registro.funcionario_id || registro.nr_cracha || registro.nm_funcionario}`));
    const emGozo = registros.filter((registro) => registro.resumo_status_key === "em_gozo").length;
    const programados = registros.filter((registro) => registro.resumo_status_key === "programado").length;
    const vencidos = registros.filter((registro) => registro.resumo_status_key === "vencido").length;
    const alerta11 = registros.filter((registro) => registro.resumo_status_key === "alerta").length;
    const saldo = registros.filter((registro) => ["saldo", "alerta", "vencido", "bloqueado"].includes(registro.resumo_status_key)).length;
    const baseAtualizadaEm = registros.reduce((latest, registro) => {
      if (!registro.importado_em) return latest;
      if (!latest) return registro.importado_em;
      return new Date(registro.importado_em).getTime() > new Date(latest).getTime() ? registro.importado_em : latest;
    }, null);
    const fonteArquivo = registros.find((registro) => registro.fonte_arquivo)?.fonte_arquivo || "";
    return {
      colaboradores: colaboradores.size,
      periodos: registros.length,
      emGozo,
      programados,
      vencidos,
      alerta11,
      saldo,
      baseAtualizadaEm,
      fonteArquivo,
    };
  }, [registros]);

  const criticos = useMemo(
    () => registros.filter((registro) => ["vencido", "alerta", "bloqueado"].includes(registro.resumo_status_key)).slice(0, 8),
    [registros]
  );

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-blue-600">Pessoas</div>
          <h1 className="mt-1 text-3xl font-black text-slate-900">Ferias</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            Central para o gestor enxergar quem esta em ferias, quem esta com periodo vencido e onde a equipe consegue liberar cada colaborador.
          </p>
        </div>

        <div className="grid w-full max-w-2xl grid-cols-1 gap-3 md:grid-cols-2">
          <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4">
            <div className="flex items-center gap-2 text-sm font-black uppercase tracking-wide text-blue-900">
              <FaCheckCircle />
              Fluxo do gestor
            </div>
            <div className="mt-3 grid grid-cols-1 gap-2 text-sm text-blue-900/90">
              <div>1. Analisa equipe e ve criticos.</div>
              <div>2. Confere quem esta em ferias agora.</div>
              <div>3. Define quando pode liberar.</div>
              <div>4. Programa a data real e acompanha.</div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-sm font-black uppercase tracking-wide text-slate-700">Base oficial</div>
                <div className="mt-1 text-xs text-slate-500">
                  {stats.baseAtualizadaEm
                    ? `Atualizada em ${formatDateTimeBR(stats.baseAtualizadaEm)}`
                    : "Nenhuma base de ferias publicada ainda"}
                </div>
                {stats.fonteArquivo ? (
                  <div className="mt-1 text-xs text-slate-400">{stats.fonteArquivo}</div>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={importing}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <FaUpload />
                {importing ? "Importando..." : "Atualizar base"}
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => exportarCSV(filtrados)}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                <FaDownload />
                Exportar visao atual
              </button>
              <button
                type="button"
                onClick={carregarDados}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                <FaSync />
                Recarregar
              </button>
            </div>
            {fallbackMode ? (
              <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                A tela esta operando em cache local porque as tabelas de ferias ainda nao existem no banco.
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.xlsx,.xls"
        onChange={handleImportFile}
        className="hidden"
      />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
        <CardKPI titulo="Colaboradores" valor={formatInt(stats.colaboradores)} cor="slate" icon={<FaUsers />} />
        <CardKPI titulo="Periodos ativos" valor={formatInt(stats.periodos)} cor="blue" icon={<FaCalendarAlt />} />
        <CardKPI titulo="Em ferias" valor={formatInt(stats.emGozo)} cor="purple" icon={<FaUserClock />} />
        <CardKPI titulo="Programados" valor={formatInt(stats.programados)} cor="emerald" icon={<FaCheckCircle />} />
        <CardKPI titulo="Vencidos" valor={formatInt(stats.vencidos)} cor="rose" icon={<FaExclamationTriangle />} />
        <CardKPI titulo="Com saldo" valor={formatInt(stats.saldo)} cor="amber" icon={<FaClock />} sub={`${formatInt(stats.alerta11)} em alerta 11 meses`} />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.4fr_0.9fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-100 pb-4 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="text-sm font-black uppercase tracking-wide text-slate-800">Gestao da equipe</div>
              <div className="mt-1 text-sm text-slate-500">
                Abra cada linha para registrar quando a equipe consegue liberar e quando o colaborador realmente vai sair.
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {STATUS_VIEW.map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setStatusView(tab.value)}
                  className={`rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition ${
                    statusView === tab.value
                      ? "bg-blue-600 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Field label="Buscar">
              <div className="relative">
                <FaSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  className={`${FIELD_INPUT} pl-10`}
                  value={busca}
                  onChange={(event) => setBusca(event.target.value)}
                  placeholder="Nome, cracha, funcao, area..."
                />
              </div>
            </Field>
            <Field label="Area">
              <select className={FIELD_INPUT} value={areaFiltro} onChange={(event) => setAreaFiltro(event.target.value)}>
                <option value="">Todas</option>
                {areasOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Funcao">
              <select className={FIELD_INPUT} value={funcaoFiltro} onChange={(event) => setFuncaoFiltro(event.target.value)}>
                <option value="">Todas</option>
                {funcoesOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Filtro rapido">
              <button
                type="button"
                onClick={() => {
                  setBusca("");
                  setAreaFiltro("");
                  setFuncaoFiltro("");
                  setStatusView("criticos");
                }}
                className="inline-flex h-[42px] items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                <FaFilter />
                Limpar filtros
              </button>
            </Field>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead>
                <tr className="text-left text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">
                  <th className="px-3 py-3">Colaborador</th>
                  <th className="px-3 py-3">Periodo</th>
                  <th className="px-3 py-3">Limite</th>
                  <th className="px-3 py-3">Saldo</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Quando pode</th>
                  <th className="px-3 py-3">Vai tirar</th>
                  <th className="px-3 py-3 text-right">Acao</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td className="px-3 py-8 text-center text-slate-500" colSpan={8}>
                      Carregando base de ferias...
                    </td>
                  </tr>
                ) : !filtrados.length ? (
                  <tr>
                    <td className="px-3 py-8 text-center text-slate-500" colSpan={8}>
                      Nenhum periodo encontrado com os filtros atuais.
                    </td>
                  </tr>
                ) : (
                  filtrados.map((registro) => (
                    <tr key={registro.ferias_id} className="hover:bg-slate-50/70">
                      <td className="px-3 py-3">
                        <div className="font-bold text-slate-900">{registro.nm_funcionario || "-"}</div>
                        <div className="text-xs text-slate-500">
                          {registro.nm_funcao || "Sem funcao"}{registro.area_titulo ? ` • ${registro.area_titulo}` : ""}
                        </div>
                        <div className="text-xs text-slate-400">Cracha {registro.nr_cracha || "-"}</div>
                      </td>
                      <td className="px-3 py-3 text-slate-600">
                        {formatDateBR(registro.dt_inicio_aquisitivo)} a {formatDateBR(registro.dt_fim_aquisitivo)}
                      </td>
                      <td className="px-3 py-3">
                        <div className="font-semibold text-slate-800">{formatDateBR(registro.dt_limite_legal)}</div>
                        <div className="text-xs text-slate-400">
                          {registro.dias_para_limite_legal !== null && registro.dias_para_limite_legal !== undefined
                            ? `${registro.dias_para_limite_legal} dia(s)`
                            : "Sem contador"}
                        </div>
                      </td>
                      <td className="px-3 py-3 font-bold text-slate-800">{formatInt(registro.dias_pendentes_total)}</td>
                      <td className="px-3 py-3">
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${registro.resumo_status_chip}`}>
                          {registro.resumo_status_label}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-600">
                        {registro.janela_sugerida_inicio
                          ? `${formatDateBR(registro.janela_sugerida_inicio)} a ${formatDateBR(registro.janela_sugerida_fim)}`
                          : "Nao definido"}
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-600">
                        {registro.programado_inicio
                          ? `${formatDateBR(registro.programado_inicio)} a ${formatDateBR(registro.programado_fim)}`
                          : registro.proximo_inicio_gozo
                            ? `${formatDateBR(registro.proximo_inicio_gozo)} a ${formatDateBR(registro.proximo_fim_gozo)}`
                            : "Nao programado"}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => setSelecionado(registro)}
                          className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold uppercase tracking-wide text-white transition hover:bg-blue-700"
                        >
                          Planejar
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-3xl border border-rose-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-black uppercase tracking-wide text-rose-700">
              <FaExclamationTriangle />
              Gestao imediata
            </div>
            <div className="mt-2 text-sm text-slate-600">
              Priorize quem ja venceu, quem bateu 11 meses e quem a operacao pediu para segurar.
            </div>
            <div className="mt-4 space-y-3">
              {!criticos.length ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
                  Nenhum periodo critico no momento.
                </div>
              ) : (
                criticos.map((registro) => (
                  <button
                    key={registro.ferias_id}
                    type="button"
                    onClick={() => setSelecionado(registro)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left transition hover:border-blue-200 hover:bg-blue-50"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-bold text-slate-900">{registro.nm_funcionario}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          {registro.nm_funcao || "Sem funcao"}{registro.area_titulo ? ` • ${registro.area_titulo}` : ""}
                        </div>
                      </div>
                      <span className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${registro.resumo_status_chip}`}>
                        {registro.resumo_status_label}
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600">
                      <div>Limite legal: {formatDateBR(registro.dt_limite_legal)}</div>
                      <div>Saldo: {formatInt(registro.dias_pendentes_total)} dia(s)</div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-sm font-black uppercase tracking-wide text-slate-800">Leitura rapida</div>
            <div className="mt-4 space-y-3 text-sm text-slate-600">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="font-semibold text-slate-900">Quem esta de ferias</div>
                <div className="mt-1">{stats.emGozo} periodo(s) com colaborador em gozo neste momento.</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="font-semibold text-slate-900">Quem precisa tirar</div>
                <div className="mt-1">
                  {stats.saldo} periodo(s) com saldo pendente e {stats.vencidos} ja estao vencidos.
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="font-semibold text-slate-900">Quando pode tirar</div>
                <div className="mt-1">
                  Use o modal para registrar a janela que a operacao consegue liberar e a data confirmada do gozo.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <PlanejamentoModal
        item={selecionado}
        open={!!selecionado}
        onClose={() => setSelecionado(null)}
        onSave={handleSalvarPlanejamento}
        saving={saving}
      />
    </div>
  );
}

function mergeFeriasData(periodos, planos, allocByKey, areaByCodigo) {
  const planByFeriasId = new Map((planos || []).map((item) => [String(item.ferias_id), item]));
  return (periodos || []).map((registro) => {
    const planejamento = planByFeriasId.get(String(registro.ferias_id)) || {};
    const allocation =
      allocByKey.get(buildFuncionarioKey(registro)) ||
      allocByKey.get(buildFuncionarioKey({ funcionario_cracha: registro.nr_cracha })) ||
      allocByKey.get(buildFuncionarioKey({ nome: registro.nm_funcionario }));
    const areaCodigo = planejamento.area_codigo || allocation?.area_codigo || "";
    const areaTitulo = planejamento.area_titulo || areaByCodigo.get(areaCodigo)?.titulo || "";
    const resumo = deriveResumoStatus({
      ...registro,
      ...planejamento,
    });
    return {
      ...registro,
      ...planejamento,
      area_codigo: areaCodigo,
      area_titulo: areaTitulo,
      resumo_status_key: resumo.key,
      resumo_status_label: resumo.label,
      resumo_status_chip: resumo.chip,
      resumo_status_order: resumo.order,
    };
  });
}
