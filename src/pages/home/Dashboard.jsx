import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  FaBriefcaseMedical,
  FaBus,
  FaCalendarAlt,
  FaChartLine,
  FaClipboardCheck,
  FaExclamationTriangle,
  FaGasPump,
  FaRoad,
  FaToolbox,
  FaTools,
  FaUserCheck,
  FaUsers,
  FaWrench,
} from "react-icons/fa";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../supabase";

const SUPABASE_A_URL = import.meta.env.VITE_SUPA_BASE_BCNT_URL;
const SUPABASE_A_ANON_KEY = import.meta.env.VITE_SUPA_BASE_BCNT_ANON_KEY;

const supabaseA =
  SUPABASE_A_URL && SUPABASE_A_ANON_KEY
    ? createClient(SUPABASE_A_URL, SUPABASE_A_ANON_KEY)
    : null;

const EMBARCADOS_ABERTOS = new Set(["ABERTA", "EM_ANALISE", "EM_EXECUCAO", "AG_PECAS"]);

function n(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeText(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function safeDateStr(value) {
  if (!value) return "";
  const raw = String(value).trim();
  if (!raw) return "";
  if (raw.includes("T")) return raw.split("T")[0];
  if (raw.includes(" ")) return raw.split(" ")[0];
  if (raw.includes("/")) {
    const parts = raw.split("/");
    if (parts.length === 3) {
      return `${parts[2].slice(0, 4)}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
    }
  }
  return raw;
}

function parseDateInput(value) {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  const text = safeDateStr(value);
  if (!text) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function todayYMD_SP() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return `${year}-${month}-${day}`;
}

function monthRange(ym) {
  if (!ym) return { start: "", end: "" };
  const [year, month] = ym.split("-").map(Number);
  if (!year || !month) return { start: "", end: "" };

  const first = new Date(Date.UTC(year, month - 1, 1));
  const last = new Date(Date.UTC(year, month, 0));
  const toYMD = (date) => {
    const yy = date.getUTCFullYear();
    const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(date.getUTCDate()).padStart(2, "0");
    return `${yy}-${mm}-${dd}`;
  };

  return { start: toYMD(first), end: toYMD(last) };
}

function monthKeyFromDate(value) {
  const date = parseDateInput(value);
  return date ? date.slice(0, 7) : "";
}

function buildLastMonthKeys(referenceYm, count = 6) {
  if (!referenceYm) return [];
  const [year, month] = referenceYm.split("-").map(Number);
  const keys = [];

  for (let index = count - 1; index >= 0; index -= 1) {
    const date = new Date(Date.UTC(year, month - 1 - index, 1));
    keys.push(
      `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`
    );
  }

  return keys;
}

function enumerateDates(start, end) {
  const startDate = parseDateInput(start);
  const endDate = parseDateInput(end);
  if (!startDate || !endDate || startDate > endDate) return [];

  const days = [];
  let cursor = new Date(`${startDate}T00:00:00`);
  const limit = new Date(`${endDate}T00:00:00`);

  while (cursor.getTime() <= limit.getTime()) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() + 1);
  }

  return days;
}

function formatMonthLabel(ym) {
  if (!ym) return "-";
  const [year, month] = ym.split("-").map(Number);
  if (!year || !month) return ym;
  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, 15, 12, 0, 0));
}

function formatShortMonthLabel(ym) {
  if (!ym) return "-";
  const [year, month] = ym.split("-").map(Number);
  if (!year || !month) return ym;
  return new Intl.DateTimeFormat("pt-BR", {
    month: "short",
  })
    .format(new Date(year, month - 1, 15, 12, 0, 0))
    .replace(".", "");
}

function formatDayLabel(iso) {
  if (!iso) return "-";
  const [year, month, day] = iso.split("-");
  if (!year || !month || !day) return iso;
  return `${day}/${month}`;
}

function fmtNum(value, decimals = 2) {
  return n(value).toLocaleString("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function fmtInt(value) {
  return Math.round(n(value)).toLocaleString("pt-BR");
}

function fmtCurrency(value) {
  return n(value).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function fmtPercent(value) {
  return `${fmtNum(value, 1)}%`;
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

function normalizeTipo(ocorrencia) {
  const value = String(ocorrencia || "").toUpperCase().trim();
  if (!value) return "";
  if (value === "RA" || value === "R.A" || value === "R.A.") return "RECOLHEU";
  if (value.includes("RECOLH")) return "RECOLHEU";
  if (value.includes("IMPRO")) return "IMPROCEDENTE";
  if (value.includes("TROC")) return "TROCA";
  if (value === "S.O.S") return "SOS";
  if (value.includes("AVARI")) return "AVARIA";
  if (value.includes("SEGUIU")) return "SEGUIU VIAGEM";
  return value;
}

function isOcorrenciaValidaParaMKBF(ocorrencia) {
  const tipo = normalizeTipo(ocorrencia);
  if (!tipo) return false;
  return tipo !== "SEGUIU VIAGEM";
}

function isTratativaConcluida(status) {
  const text = normalizeText(status);
  return text.includes("conclu") || text.includes("resolvid");
}

function isTratativaPendente(status) {
  const text = normalizeText(status);
  return text.includes("pendente") || text.includes("aberto");
}

function parseHistoricoGozos(historico) {
  const text = String(historico || "").trim();
  if (!text) return [];

  return text
    .split(/(?=Periodo \d+:)/g)
    .map((chunk) => {
      const gozo = chunk.match(
        /Gozo\s+(\d{2}\/\d{2}\/\d{4})\s+a\s+(\d{2}\/\d{2}\/\d{4})/i
      );

      return {
        gozoInicio: parseDateInput(gozo?.[1]),
        gozoFim: parseDateInput(gozo?.[2]),
      };
    })
    .filter((item) => item.gozoInicio || item.gozoFim)
    .sort((left, right) =>
      String(right.gozoInicio || "").localeCompare(String(left.gozoInicio || ""))
    );
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
    return { key: "bloqueado", label: "Segurar operacao", order: 2 };
  }
  if (vencido) {
    return { key: "vencido", label: "Ferias vencidas", order: 0 };
  }
  if (emGozo) {
    return { key: "em_gozo", label: "Em ferias", order: 1 };
  }
  if (programado) {
    return { key: "programado", label: "Programado", order: 3 };
  }
  if (alerta) {
    return { key: "alerta", label: "Alerta 11 meses", order: 4 };
  }
  if (saldo > 0) {
    return { key: "saldo", label: "Saldo pendente", order: 5 };
  }
  return { key: "quitado", label: "Quitado", order: 6 };
}

function getCurrentGozoPeriod(item) {
  const hoje = parseDateInput(new Date());
  if (!hoje) return null;

  const start = parseDateInput(item.programado_inicio || item.proximo_inicio_gozo);
  const end = parseDateInput(item.programado_fim || item.proximo_fim_gozo);
  if (start && end && start <= hoje && end >= hoje) {
    return { inicio: start, fim: end };
  }

  if (item.resumo_status_key !== "em_gozo" && Number(item.dias_em_andamento || 0) <= 0) {
    return null;
  }

  const historico = parseHistoricoGozos(item.historico_gozos);
  const atual = historico.find(
    (periodo) =>
      periodo.gozoInicio &&
      periodo.gozoFim &&
      periodo.gozoInicio <= hoje &&
      periodo.gozoFim >= hoje
  );

  return atual ? { inicio: atual.gozoInicio, fim: atual.gozoFim } : null;
}

function getDisplayStart(item) {
  const direct = item.programado_inicio || item.proximo_inicio_gozo || null;
  if (direct) return direct;
  return getCurrentGozoPeriod(item)?.inicio || null;
}

function getDisplayEnd(item) {
  const direct = item.programado_fim || item.proximo_fim_gozo || null;
  if (direct) return direct;
  return getCurrentGozoPeriod(item)?.fim || null;
}

function statusNorm(status) {
  const value = String(status || "").trim().toUpperCase();
  if (!value || value === "AGUARDANDO INSTRUTOR" || value === "AG_ACOMPANHAMENTO") {
    return "AGUARDANDO_INSTRUTOR";
  }
  if (value === "CONCLUIDO") return "OK";
  if (value === "TRATATIVA") return "ATAS";
  return value;
}

function getLinhaFocoAcompanhamento(item) {
  const metadata = item?.metadata && typeof item.metadata === "object" ? item.metadata : {};
  const linhaMeta = String(metadata?.linha_foco || "").trim();
  if (linhaMeta) return linhaMeta.toUpperCase();

  const linhaDireta = String(item?.linha_foco || "").trim();
  if (linhaDireta) return linhaDireta.toUpperCase();

  const motivo = String(item?.motivo || "");
  const match = motivo.match(/linha\s+([a-z0-9]+)/i);
  return match?.[1] ? match[1].toUpperCase() : "SEM LINHA";
}

function parseHoraToMin(hora) {
  const txt = String(hora || "").trim();
  if (!txt) return null;
  const parts = txt.split(":");
  if (parts.length < 2) return null;
  const hh = Number(parts[0]);
  const mm = Number(parts[1]);
  const ss = Number(parts[2] || 0);
  if (![hh, mm, ss].every(Number.isFinite)) return null;
  return hh * 60 + mm + ss / 60;
}

function getSessionDurationMinutes(sessao) {
  const inicioHora = parseHoraToMin(sessao?.hora_inicio);
  const fimHora = parseHoraToMin(sessao?.hora_fim);

  if (
    inicioHora != null &&
    fimHora != null &&
    Number.isFinite(inicioHora) &&
    Number.isFinite(fimHora) &&
    fimHora >= inicioHora
  ) {
    return fimHora - inicioHora;
  }

  const inicio = sessao?.iniciado_em ? new Date(sessao.iniciado_em) : null;
  const fim = sessao?.encerrado_em ? new Date(sessao.encerrado_em) : null;
  if (
    inicio &&
    fim &&
    !Number.isNaN(inicio.getTime()) &&
    !Number.isNaN(fim.getTime()) &&
    fim.getTime() >= inicio.getTime()
  ) {
    return (fim.getTime() - inicio.getTime()) / 60000;
  }

  return 0;
}

async function fetchAllRows(queryBuilder, orderColumn) {
  const pageSize = 1000;
  let from = 0;
  let rows = [];

  while (true) {
    let query = queryBuilder.range(from, from + pageSize - 1);
    if (orderColumn) query = query.order(orderColumn, { ascending: false });
    const { data, error } = await query;
    if (error) throw error;
    const chunk = data || [];
    rows = rows.concat(chunk);
    if (chunk.length < pageSize) break;
    from += pageSize;
    if (rows.length >= 100000) break;
  }

  return rows;
}

function TrendTooltip({ active, payload, label, labelFormatter, valueFormatter }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-lg">
      <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
        {labelFormatter ? labelFormatter(label) : label}
      </div>
      <div className="mt-1 text-sm font-bold text-slate-900">
        {valueFormatter ? valueFormatter(payload[0].value) : payload[0].value}
      </div>
    </div>
  );
}

function HoverKpiCard({
  title,
  value,
  sub,
  meta,
  icon,
  tone = "blue",
  chartColor = "#2563EB",
  chartData = [],
  labelFormatter,
  valueFormatter,
  hoverTitle,
}) {
  const tones = {
    blue: "from-blue-50 via-cyan-50 to-white border-blue-200 text-blue-700",
    emerald: "from-emerald-50 via-teal-50 to-white border-emerald-200 text-emerald-700",
    amber: "from-amber-50 via-orange-50 to-white border-amber-200 text-amber-700",
    rose: "from-rose-50 via-pink-50 to-white border-rose-200 text-rose-700",
    violet: "from-violet-50 via-fuchsia-50 to-white border-violet-200 text-violet-700",
    slate: "from-slate-50 via-gray-50 to-white border-slate-200 text-slate-700",
  };

  return (
    <article className="group relative">
      <div
        className={`rounded-3xl border bg-gradient-to-br ${tones[tone]} p-5 shadow-sm transition duration-200 group-hover:-translate-y-0.5 group-hover:shadow-lg`}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] opacity-80">{title}</p>
            <p className="mt-3 text-3xl font-black text-slate-900">{value}</p>
            <p className="mt-2 text-sm font-semibold text-slate-700">{sub}</p>
            {meta ? <p className="mt-1 text-xs font-semibold text-slate-500">{meta}</p> : null}
          </div>
          <div className="rounded-2xl bg-white/85 p-3 text-xl shadow-sm">{icon}</div>
        </div>

        <div className="mt-4 h-14 rounded-2xl bg-white/70 p-2 shadow-inner">
          {chartData.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id={`grad-${title}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={chartColor} stopOpacity={0.35} />
                    <stop offset="95%" stopColor={chartColor} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="valor"
                  stroke={chartColor}
                  fill={`url(#grad-${title})`}
                  strokeWidth={2}
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-[11px] font-semibold text-slate-400">
              Sem serie para este periodo
            </div>
          )}
        </div>
      </div>

      <div className="pointer-events-none absolute left-0 right-0 top-full z-20 mt-3 opacity-0 transition duration-200 group-hover:pointer-events-auto group-hover:opacity-100">
        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-2xl">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
                Evolucao
              </div>
              <div className="mt-1 text-sm font-bold text-slate-900">
                {hoverTitle || title}
              </div>
            </div>
            <div className="text-xs font-semibold text-slate-500">
              Passe o mouse para ler a curva
            </div>
          </div>
          <div className="h-40">
            {chartData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id={`hover-grad-${title}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={chartColor} stopOpacity={0.28} />
                      <stop offset="95%" stopColor={chartColor} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#E2E8F0" strokeDasharray="3 3" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} />
                  <YAxis hide />
                  <Tooltip
                    content={
                      <TrendTooltip
                        labelFormatter={labelFormatter}
                        valueFormatter={valueFormatter}
                      />
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="valor"
                    stroke={chartColor}
                    fill={`url(#hover-grad-${title})`}
                    strokeWidth={2.5}
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center rounded-2xl bg-slate-50 text-sm font-semibold text-slate-400">
                Sem base para mostrar a evolucao agora.
              </div>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

function SectionCard({ title, subtitle, children, action = null }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-black text-slate-900">{title}</h2>
          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
        </div>
        {action}
      </div>
      <div className="pt-4">{children}</div>
    </section>
  );
}

function ProgressRow({ label, value, total, detail, tone = "blue" }) {
  const percent = total > 0 ? (value / total) * 100 : 0;
  const tones = {
    blue: "bg-blue-500",
    emerald: "bg-emerald-500",
    amber: "bg-amber-500",
    rose: "bg-rose-500",
    violet: "bg-violet-500",
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-slate-800">{label}</p>
          <p className="text-xs font-medium text-slate-500">{detail}</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-black text-slate-900">{fmtPercent(percent)}</p>
          <p className="text-xs font-medium text-slate-500">
            {fmtInt(value)} de {fmtInt(total)}
          </p>
        </div>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${tones[tone]}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

const EMPTY_STATE = {
  periodo: "",
  atualizadoEm: "",
  kpis: {
    kmlMes: 0,
    kmMes: 0,
    litrosMes: 0,
    mkbf: 0,
    mkbfKm: 0,
    mkbfOcorrencias: 0,
    avariasPct: 0,
    avariasValorCobrado: 0,
    avariasValorTotal: 0,
    tratativasPct: 0,
    tratativasConcluidas: 0,
    tratativasTotal: 0,
    feriasEmGozo: 0,
    feriasProgramadasMes: 0,
    feriasVencidas: 0,
    embarcadosAbertos: 0,
    embarcadosCriticos: 0,
  },
  pulso: {
    instrutoresMes: 0,
    acompanhamentosAtivos: 0,
    avariasPendentes: 0,
    tratativasPendentes: 0,
    tratativasAtrasadas: 0,
  },
  trends: {
    kml: [],
    mkbf: [],
    avarias: [],
    tratativas: [],
    ferias: [],
    embarcados: [],
  },
  pioresLinhas: [],
  instrutores: [],
  avarias: {
    elegiveis: 0,
    cobradas: 0,
    pendentes: 0,
    canceladas: 0,
    valorCobrado: 0,
    valorTotal: 0,
  },
  tratativas: {
    total: 0,
    concluidas: 0,
    pendentes: 0,
    atrasadas: 0,
  },
  ferias: {
    emGozo: 0,
    programadasMes: 0,
    vencidas: 0,
    alerta11: 0,
  },
  embarcados: {
    abertas: 0,
    criticas: 0,
    emAnalise: 0,
    emExecucao: 0,
    agPecas: 0,
  },
  alertas: [],
};

export default function Dashboard() {
  const { user } = useAuth();
  const referenciaDia = useMemo(() => todayYMD_SP(), []);
  const referenciaMes = useMemo(() => referenciaDia.slice(0, 7), [referenciaDia]);

  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [dashboard, setDashboard] = useState(EMPTY_STATE);

  useEffect(() => {
    let ativo = true;

    async function carregarDashboard() {
      setLoading(true);
      setErro("");

      try {
        const { start, end } = monthRange(referenciaMes);
        const dailyKeys = enumerateDates(start, referenciaDia);
        const monthKeys = buildLastMonthKeys(referenciaMes, 6);

        const [
          premiacaoMes,
          kmRodadoMes,
          sosMes,
          avariasRows,
          tratativasRows,
          acompanhamentosMes,
          sessoesMes,
          feriasPeriodos,
          feriasPlanos,
          afastadosRows,
          embarcadosRows,
        ] = await Promise.all([
          supabaseA
            ? fetchAllRows(
                supabaseA
                  .from("premiacao_diaria_atualizada")
                  .select(
                    "id_premiacao_diaria, dia, linha, km_rodado, litros_consumidos, meta_kml_usada, litros_ideais"
                  )
                  .gte("dia", start)
                  .lte("dia", end),
                "dia"
              )
            : Promise.resolve([]),
          fetchAllRows(
            supabase
              .from("km_rodado_diario")
              .select("data, km_total")
              .gte("data", start)
              .lte("data", end),
            "data"
          ),
          fetchAllRows(
            supabase
              .from("sos_acionamentos")
              .select("id, data_sos, ocorrencia")
              .gte("data_sos", start)
              .lte("data_sos", end),
            "data_sos"
          ),
          fetchAllRows(
            supabase
              .from("avarias")
              .select("id, created_at, status_cobranca, valor_total_orcamento, valor_cobrado"),
            "created_at"
          ),
          fetchAllRows(
            supabase.from("tratativas").select("id, created_at, status"),
            "created_at"
          ),
          fetchAllRows(
            supabase
              .from("diesel_acompanhamentos")
              .select(
                "id, created_at, dt_inicio_monitoramento, status, instrutor_nome, instrutor_login, linha_foco, motivo, metadata"
              )
              .gte("created_at", `${start}T00:00:00`)
              .lt("created_at", `${end}T23:59:59`),
            "created_at"
          ),
          fetchAllRows(
            supabase
              .from("diesel_acompanhamento_sessoes")
              .select(
                "id, acompanhamento_id, data_sessao, hora_inicio, hora_fim, iniciado_em, encerrado_em, instrutor_nome, instrutor_login"
              )
              .gte("data_sessao", start)
              .lte("data_sessao", end),
            "data_sessao"
          ),
          fetchAllRows(
            supabase.from("ferias_periodos_importados").select("*").eq("ativo", true),
            "nm_funcionario"
          ),
          fetchAllRows(
            supabase.from("ferias_planejamento").select("*"),
            "atualizado_em"
          ),
          fetchAllRows(
            supabase.from("afastados").select("*").eq("ativo", true),
            "data_inicio"
          ),
          fetchAllRows(
            supabase
              .from("embarcados_solicitacoes_reparo")
              .select("id, created_at, status, prioridade, veiculo, tipo_embarcado"),
            "created_at"
          ),
        ]);

        const premiacaoNormalizada = (premiacaoMes || [])
          .map((row) => {
            const km = n(row.km_rodado);
            const litros = n(row.litros_consumidos);
            const kml = litros > 0 ? km / litros : 0;
            return {
              linha: String(row.linha || "").trim().toUpperCase() || "SEM LINHA",
              dia: safeDateStr(row.dia),
              km,
              litros,
              kml,
              meta: n(row.meta_kml_usada),
              litrosIdeais: n(row.litros_ideais),
            };
          })
          .filter(
            (row) => row.dia && row.km > 0 && row.litros > 0 && row.kml >= 1.5 && row.kml <= 5
          );

        const linhasMap = new Map();
        const kmlPorDiaMap = new Map();
        premiacaoNormalizada.forEach((row) => {
          if (!linhasMap.has(row.linha)) {
            linhasMap.set(row.linha, {
              linha: row.linha,
              km: 0,
              litros: 0,
              litrosIdeais: 0,
            });
          }
          const linhaItem = linhasMap.get(row.linha);
          linhaItem.km += row.km;
          linhaItem.litros += row.litros;
          linhaItem.litrosIdeais += row.litrosIdeais;

          if (!kmlPorDiaMap.has(row.dia)) kmlPorDiaMap.set(row.dia, { km: 0, litros: 0 });
          const diaItem = kmlPorDiaMap.get(row.dia);
          diaItem.km += row.km;
          diaItem.litros += row.litros;
        });

        const kmMes = premiacaoNormalizada.reduce((acc, row) => acc + row.km, 0);
        const litrosMes = premiacaoNormalizada.reduce((acc, row) => acc + row.litros, 0);
        const kmlMes = litrosMes > 0 ? kmMes / litrosMes : 0;

        const pioresLinhas = [...linhasMap.values()]
          .map((item) => ({
            ...item,
            kml: item.litros > 0 ? item.km / item.litros : 0,
            meta: item.litrosIdeais > 0 ? item.km / item.litrosIdeais : 0,
          }))
          .filter((item) => item.km > 0 && item.litros > 0)
          .sort((a, b) => a.kml - b.kml)
          .slice(0, 3);

        const kmlTrend = dailyKeys.map((dia) => {
          const day = kmlPorDiaMap.get(dia);
          const valor = day?.litros > 0 ? day.km / day.litros : 0;
          return {
            key: dia,
            label: formatDayLabel(dia),
            valor,
          };
        });

        const kmPorDiaMap = new Map();
        (kmRodadoMes || []).forEach((row) => {
          const key = safeDateStr(row.data);
          if (!key) return;
          kmPorDiaMap.set(key, n(kmPorDiaMap.get(key)) + n(row.km_total));
        });

        const sosPorDiaMap = new Map();
        (sosMes || []).forEach((row) => {
          const key = safeDateStr(row.data_sos);
          if (!key) return;
          if (!sosPorDiaMap.has(key)) sosPorDiaMap.set(key, 0);
          sosPorDiaMap.set(
            key,
            n(sosPorDiaMap.get(key)) + (isOcorrenciaValidaParaMKBF(row.ocorrencia) ? 1 : 0)
          );
        });

        const mkbfKm = [...kmPorDiaMap.values()].reduce((acc, value) => acc + n(value), 0);
        const mkbfOcorrencias = [...sosPorDiaMap.values()].reduce((acc, value) => acc + n(value), 0);
        const mkbf = mkbfOcorrencias > 0 ? mkbfKm / mkbfOcorrencias : 0;
        const mkbfTrend = dailyKeys.map((dia) => {
          const kmDia = n(kmPorDiaMap.get(dia));
          const ocorrenciasDia = n(sosPorDiaMap.get(dia));
          return {
            key: dia,
            label: formatDayLabel(dia),
            valor: ocorrenciasDia > 0 ? kmDia / ocorrenciasDia : 0,
          };
        });

        const avariasElegiveis = (avariasRows || []).filter((row) =>
          ["COBRADA", "PENDENTE", "CANCELADA"].includes(
            String(row.status_cobranca || "").trim().toUpperCase()
          )
        );
        const avariasCobradas = avariasElegiveis.filter(
          (row) => String(row.status_cobranca || "").trim().toUpperCase() === "COBRADA"
        );
        const avariasPendentes = avariasElegiveis.filter(
          (row) => String(row.status_cobranca || "").trim().toUpperCase() === "PENDENTE"
        );
        const avariasCanceladas = avariasElegiveis.filter(
          (row) => String(row.status_cobranca || "").trim().toUpperCase() === "CANCELADA"
        );
        const avariasValorCobrado = avariasCobradas.reduce(
          (acc, row) => acc + (n(row.valor_cobrado) || n(row.valor_total_orcamento)),
          0
        );
        const avariasValorTotal = avariasElegiveis.reduce(
          (acc, row) => acc + (n(row.valor_total_orcamento) || n(row.valor_cobrado)),
          0
        );
        const avariasPct =
          avariasElegiveis.length > 0 ? (avariasCobradas.length / avariasElegiveis.length) * 100 : 0;

        const avariaTrend = monthKeys.map((monthKey) => {
          const rows = avariasElegiveis.filter((row) => monthKeyFromDate(row.created_at) === monthKey);
          const cobradas = rows.filter(
            (row) => String(row.status_cobranca || "").trim().toUpperCase() === "COBRADA"
          );
          return {
            key: monthKey,
            label: formatShortMonthLabel(monthKey),
            valor: rows.length > 0 ? (cobradas.length / rows.length) * 100 : 0,
          };
        });

        const tratativasTotal = (tratativasRows || []).length;
        const tratativasConcluidas = (tratativasRows || []).filter((row) =>
          isTratativaConcluida(row.status)
        ).length;
        const tratativasPendentes = (tratativasRows || []).filter((row) =>
          isTratativaPendente(row.status)
        ).length;
        const tratativasAtrasadas = (tratativasRows || []).filter((row) => {
          if (!isTratativaPendente(row.status)) return false;
          const createdAt = row.created_at ? new Date(row.created_at).getTime() : 0;
          if (!createdAt) return false;
          return createdAt < new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).getTime();
        }).length;
        const tratativasPct =
          tratativasTotal > 0 ? (tratativasConcluidas / tratativasTotal) * 100 : 0;

        const tratativaTrend = monthKeys.map((monthKey) => {
          const rows = (tratativasRows || []).filter(
            (row) => monthKeyFromDate(row.created_at) === monthKey
          );
          const concluidas = rows.filter((row) => isTratativaConcluida(row.status)).length;
          return {
            key: monthKey,
            label: formatShortMonthLabel(monthKey),
            valor: rows.length > 0 ? (concluidas / rows.length) * 100 : 0,
          };
        });

        const afastadosKeys = new Set(
          (afastadosRows || []).map((row) => buildFuncionarioKey(row)).filter(Boolean)
        );
        const planByFeriasId = new Map(
          (feriasPlanos || []).map((item) => [String(item.ferias_id), item])
        );
        const feriasMerge = (feriasPeriodos || [])
          .flatMap((registro) => {
            const keys = [
              buildFuncionarioKey(registro),
              buildFuncionarioKey({ funcionario_cracha: registro.nr_cracha }),
              buildFuncionarioKey({ nome: registro.nm_funcionario }),
            ].filter(Boolean);
            if (keys.some((key) => afastadosKeys.has(key))) return [];

            const planejamento = planByFeriasId.get(String(registro.ferias_id)) || {};
            const resumo = deriveResumoStatus({ ...registro, ...planejamento });
            return [
              {
                ...registro,
                ...planejamento,
                resumo_status_key: resumo.key,
                resumo_status_label: resumo.label,
              },
            ];
          })
          .filter(Boolean);

        const feriasEmGozo = feriasMerge.filter(
          (item) => item.resumo_status_key === "em_gozo"
        ).length;
        const feriasProgramadasMes = feriasMerge.filter((item) => {
          const startDisplay = getDisplayStart(item);
          return monthKeyFromDate(startDisplay) === referenciaMes;
        }).length;
        const feriasVencidas = feriasMerge.filter(
          (item) => item.resumo_status_key === "vencido"
        ).length;
        const feriasAlerta11 = feriasMerge.filter(
          (item) => item.resumo_status_key === "alerta"
        ).length;

        const feriasTrend = dailyKeys.map((dia) => {
          const ativos = feriasMerge.filter((item) => {
            const startDisplay = parseDateInput(getDisplayStart(item));
            const endDisplay = parseDateInput(getDisplayEnd(item));
            return startDisplay && endDisplay && startDisplay <= dia && endDisplay >= dia;
          }).length;

          return {
            key: dia,
            label: formatDayLabel(dia),
            valor: ativos,
          };
        });

        const sessoesPorAcompanhamento = new Map();
        (sessoesMes || []).forEach((sessao) => {
          const acompanhamentoId = sessao?.acompanhamento_id;
          if (!acompanhamentoId) return;
          if (!sessoesPorAcompanhamento.has(acompanhamentoId)) {
            sessoesPorAcompanhamento.set(acompanhamentoId, []);
          }
          sessoesPorAcompanhamento.get(acompanhamentoId).push({
            data_ref:
              safeDateStr(sessao?.data_sessao) ||
              safeDateStr(sessao?.iniciado_em) ||
              safeDateStr(sessao?.encerrado_em),
            instrutor_nome:
              String(sessao?.instrutor_nome || "").trim() ||
              String(sessao?.instrutor_login || "").trim(),
            duracao_min: getSessionDurationMinutes(sessao),
          });
        });

        const instrutoresMap = new Map();
        (acompanhamentosMes || []).forEach((acompanhamento) => {
          const sessoes = sessoesPorAcompanhamento.get(acompanhamento.id) || [];
          const linha = getLinhaFocoAcompanhamento(acompanhamento);
          const status = statusNorm(acompanhamento.status);

          const registros = sessoes.length
            ? sessoes
            : [
                {
                  data_ref:
                    safeDateStr(acompanhamento.dt_inicio_monitoramento) ||
                    safeDateStr(acompanhamento.created_at),
                  instrutor_nome:
                    String(acompanhamento?.instrutor_nome || "").trim() ||
                    String(acompanhamento?.instrutor_login || "").trim(),
                  duracao_min: 0,
                },
              ];

          registros.forEach((registro) => {
            const nomeInstrutor = String(registro.instrutor_nome || "").trim();
            if (!nomeInstrutor) return;
            if (!instrutoresMap.has(nomeInstrutor)) {
              instrutoresMap.set(nomeInstrutor, {
                instrutor_nome: nomeInstrutor,
                total_acompanhamentos: 0,
                concluidos: 0,
                em_aberto: 0,
                total_minutos: 0,
                linhas: new Set(),
              });
            }
            const item = instrutoresMap.get(nomeInstrutor);
            item.total_acompanhamentos += 1;
            item.total_minutos += n(registro.duracao_min);
            if (["OK", "ENCERRADO", "ATAS"].includes(status)) {
              item.concluidos += 1;
            } else {
              item.em_aberto += 1;
            }
            if (linha) item.linhas.add(linha);
          });
        });

        const instrutores = [...instrutoresMap.values()]
          .map((item) => ({
            ...item,
            linhas: item.linhas.size,
            media_minutos:
              item.total_acompanhamentos > 0
                ? item.total_minutos / item.total_acompanhamentos
                : 0,
          }))
          .sort((a, b) => {
            if (b.total_acompanhamentos !== a.total_acompanhamentos) {
              return b.total_acompanhamentos - a.total_acompanhamentos;
            }
            return b.total_minutos - a.total_minutos;
          })
          .slice(0, 6);

        const acompanhamentosAtivos = (acompanhamentosMes || []).filter((acompanhamento) => {
          const status = statusNorm(acompanhamento.status);
          return !["OK", "ENCERRADO", "ATAS"].includes(status);
        }).length;

        const embarcadosAbertos = (embarcadosRows || []).filter((row) =>
          EMBARCADOS_ABERTOS.has(String(row.status || "").trim().toUpperCase())
        );
        const embarcadosCriticos = embarcadosAbertos.filter(
          (row) => String(row.prioridade || "").trim().toUpperCase() === "CRITICA"
        );
        const embarcados = {
          abertas: embarcadosAbertos.length,
          criticas: embarcadosCriticos.length,
          emAnalise: embarcadosAbertos.filter(
            (row) => String(row.status || "").trim().toUpperCase() === "EM_ANALISE"
          ).length,
          emExecucao: embarcadosAbertos.filter(
            (row) => String(row.status || "").trim().toUpperCase() === "EM_EXECUCAO"
          ).length,
          agPecas: embarcadosAbertos.filter(
            (row) => String(row.status || "").trim().toUpperCase() === "AG_PECAS"
          ).length,
        };

        const embarcadosTrend = monthKeys.map((monthKey) => {
          const rows = (embarcadosRows || []).filter(
            (row) =>
              monthKeyFromDate(row.created_at) === monthKey &&
              EMBARCADOS_ABERTOS.has(String(row.status || "").trim().toUpperCase())
          );
          return {
            key: monthKey,
            label: formatShortMonthLabel(monthKey),
            valor: rows.length,
          };
        });

        const alertas = [
          {
            titulo: "Avarias pendentes",
            valor: avariasPendentes.length,
            detalhe: "Itens ainda sem cobranca finalizada",
            tone: "amber",
          },
          {
            titulo: "Tratativas atrasadas",
            valor: tratativasAtrasadas,
            detalhe: "Pendencias com mais de 10 dias",
            tone: "rose",
          },
          {
            titulo: "Ferias vencidas",
            valor: feriasVencidas,
            detalhe: "Colaboradores que ja estouraram o limite",
            tone: "violet",
          },
          {
            titulo: "Acompanhamentos em aberto",
            valor: acompanhamentosAtivos,
            detalhe: "Diesel ainda sem fechamento operacional",
            tone: "blue",
          },
          {
            titulo: "Servicos criticos embarcados",
            valor: embarcadosCriticos.length,
            detalhe: "Solicitacoes abertas com prioridade critica",
            tone: "amber",
          },
        ];

        if (!ativo) return;

        setDashboard({
          periodo: formatMonthLabel(referenciaMes),
          atualizadoEm: new Intl.DateTimeFormat("pt-BR", {
            dateStyle: "short",
            timeStyle: "short",
            timeZone: "America/Sao_Paulo",
          }).format(new Date()),
          kpis: {
            kmlMes,
            kmMes,
            litrosMes,
            mkbf,
            mkbfKm,
            mkbfOcorrencias,
            avariasPct,
            avariasValorCobrado,
            avariasValorTotal,
            tratativasPct,
            tratativasConcluidas,
            tratativasTotal,
            feriasEmGozo,
            feriasProgramadasMes,
            feriasVencidas,
            embarcadosAbertos: embarcados.abertas,
            embarcadosCriticos: embarcados.criticas,
          },
          pulso: {
            instrutoresMes: instrutoresMap.size,
            acompanhamentosAtivos,
            avariasPendentes: avariasPendentes.length,
            tratativasPendentes,
            tratativasAtrasadas,
          },
          trends: {
            kml: kmlTrend,
            mkbf: mkbfTrend,
            avarias: avariaTrend,
            tratativas: tratativaTrend,
            ferias: feriasTrend,
            embarcados: embarcadosTrend,
          },
          pioresLinhas,
          instrutores,
          avarias: {
            elegiveis: avariasElegiveis.length,
            cobradas: avariasCobradas.length,
            pendentes: avariasPendentes.length,
            canceladas: avariasCanceladas.length,
            valorCobrado: avariasValorCobrado,
            valorTotal: avariasValorTotal,
          },
          tratativas: {
            total: tratativasTotal,
            concluidas: tratativasConcluidas,
            pendentes: tratativasPendentes,
            atrasadas: tratativasAtrasadas,
          },
          ferias: {
            emGozo: feriasEmGozo,
            programadasMes: feriasProgramadasMes,
            vencidas: feriasVencidas,
            alerta11: feriasAlerta11,
          },
          embarcados,
          alertas,
        });
      } catch (error) {
        console.error("Erro ao carregar dashboard:", error);
        if (!ativo) return;
        setErro(error?.message || "Nao foi possivel carregar o dashboard.");
        setDashboard(EMPTY_STATE);
      } finally {
        if (ativo) setLoading(false);
      }
    }

    carregarDashboard();
    return () => {
      ativo = false;
    };
  }, [referenciaDia, referenciaMes]);

  const embarcadosStatusChart = useMemo(
    () => [
      { label: "Abertas", valor: dashboard.embarcados.abertas },
      { label: "Em analise", valor: dashboard.embarcados.emAnalise },
      { label: "Em execucao", valor: dashboard.embarcados.emExecucao },
      { label: "Ag. pecas", valor: dashboard.embarcados.agPecas },
    ],
    [dashboard.embarcados]
  );

  const [mostrarDetalhes, setMostrarDetalhes] = useState(() => {
    try {
      return localStorage.getItem("inove_dash_detalhes") === "1";
    } catch {
      return false;
    }
  });

  function toggleDetalhes() {
    setMostrarDetalhes((current) => {
      const next = !current;
      try {
        localStorage.setItem("inove_dash_detalhes", next ? "1" : "0");
      } catch {
        // sem storage: vale so na sessao
      }
      return next;
    });
  }

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-blue-600">
              Painel executivo
            </p>
            <h1 className="mt-3 text-3xl font-black text-slate-900">
              Dashboard do gestor
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              Painel vivo para olhar desempenho, risco, pessoas e servicos em uma leitura so.
              Os KPIs abaixo abrem a evolucao no hover.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
                Mes corrente
              </p>
              <p className="mt-1 text-lg font-black capitalize text-slate-900">
                {dashboard.periodo || formatMonthLabel(referenciaMes)}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
                Atualizacao
              </p>
              <p className="mt-1 text-lg font-black text-slate-900">
                {loading ? "Carregando..." : dashboard.atualizadoEm || "-"}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-slate-600">
          <span className="rounded-full bg-blue-50 px-3 py-1 font-semibold text-blue-700">
            Usuario: {user?.nome || user?.login || "-"}
          </span>
          <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700">
            Perfil: {user?.nivel || "-"}
          </span>
          <span className="rounded-full bg-emerald-50 px-3 py-1 font-semibold text-emerald-700">
            Base de Maio ativa
          </span>
        </div>
      </section>

      {erro ? (
        <section className="rounded-3xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">
          {erro}
        </section>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-3 2xl:grid-cols-6">
        <HoverKpiCard
          title="KM/L do mes"
          value={loading ? "--" : fmtNum(dashboard.kpis.kmlMes)}
          sub={loading ? "Calculando..." : `${fmtInt(dashboard.kpis.kmMes)} km rodados`}
          meta={loading ? "" : `${fmtInt(dashboard.kpis.litrosMes)} litros consumidos`}
          icon={<FaGasPump className="text-emerald-600" />}
          tone="emerald"
          chartColor="#10B981"
          chartData={dashboard.trends.kml}
          labelFormatter={(label) => `Dia ${label}`}
          valueFormatter={(value) => `${fmtNum(value)} km/l`}
          hoverTitle="Evolucao diaria do KM/L em Maio"
        />
        <HoverKpiCard
          title="MKBF"
          value={loading ? "--" : fmtNum(dashboard.kpis.mkbf)}
          sub={
            loading
              ? "Calculando..."
              : `${fmtInt(dashboard.kpis.mkbfOcorrencias)} ocorrencias validas`
          }
          meta={loading ? "" : `${fmtInt(dashboard.kpis.mkbfKm)} km na base SOS`}
          icon={<FaRoad className="text-blue-600" />}
          tone="blue"
          chartColor="#2563EB"
          chartData={dashboard.trends.mkbf}
          labelFormatter={(label) => `Dia ${label}`}
          valueFormatter={(value) => `${fmtNum(value)} km`}
          hoverTitle="MKBF diario do mes corrente"
        />
        <HoverKpiCard
          title="% cobranca de avaria"
          value={loading ? "--" : fmtPercent(dashboard.kpis.avariasPct)}
          sub={
            loading
              ? "Calculando..."
              : `${fmtCurrency(dashboard.kpis.avariasValorCobrado)} recuperados`
          }
          meta={
            loading
              ? ""
              : `${fmtCurrency(dashboard.kpis.avariasValorTotal)} no historico elegivel`
          }
          icon={<FaClipboardCheck className="text-amber-600" />}
          tone="amber"
          chartColor="#F59E0B"
          chartData={dashboard.trends.avarias}
          labelFormatter={(label) => `Mes ${label}`}
          valueFormatter={(value) => fmtPercent(value)}
          hoverTitle="Percentual mensal de cobranca de avarias"
        />
        <HoverKpiCard
          title="Tratativas resolvidas"
          value={loading ? "--" : fmtPercent(dashboard.kpis.tratativasPct)}
          sub={
            loading
              ? "Calculando..."
              : `${fmtInt(dashboard.kpis.tratativasConcluidas)} concluidas`
          }
          meta={loading ? "" : `${fmtInt(dashboard.kpis.tratativasTotal)} no historico`}
          icon={<FaTools className="text-rose-600" />}
          tone="rose"
          chartColor="#E11D48"
          chartData={dashboard.trends.tratativas}
          labelFormatter={(label) => `Mes ${label}`}
          valueFormatter={(value) => fmtPercent(value)}
          hoverTitle="Fechamento mensal das tratativas"
        />
        <HoverKpiCard
          title="Ferias ativas"
          value={loading ? "--" : fmtInt(dashboard.kpis.feriasEmGozo)}
          sub={
            loading
              ? "Calculando..."
              : `${fmtInt(dashboard.kpis.feriasProgramadasMes)} programados em Maio`
          }
          meta={loading ? "" : `${fmtInt(dashboard.kpis.feriasVencidas)} ferias vencidas`}
          icon={<FaCalendarAlt className="text-violet-600" />}
          tone="violet"
          chartColor="#7C3AED"
          chartData={dashboard.trends.ferias}
          labelFormatter={(label) => `Dia ${label}`}
          valueFormatter={(value) => `${fmtInt(value)} colaboradores`}
          hoverTitle="Colaboradores de ferias por dia no mes"
        />
        <HoverKpiCard
          title="Servicos embarcados"
          value={loading ? "--" : fmtInt(dashboard.kpis.embarcadosAbertos)}
          sub={
            loading
              ? "Calculando..."
              : `${fmtInt(dashboard.kpis.embarcadosCriticos)} criticos em aberto`
          }
          meta="Solicitacoes de reparo nao concluídas"
          icon={<FaWrench className="text-slate-700" />}
          tone="slate"
          chartColor="#334155"
          chartData={dashboard.trends.embarcados}
          labelFormatter={(label) => `Mes ${label}`}
          valueFormatter={(value) => `${fmtInt(value)} abertas`}
          hoverTitle="Volume mensal de servicos embarcados em aberto"
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.25fr,0.75fr]">
        <SectionCard
          title="Diesel do mes"
          subtitle="Piores linhas de KM/L e a curva diaria que esta puxando o consumo."
          action={
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-emerald-700">
              Maio em foco
            </span>
          }
        >
          <div className="grid gap-5 xl:grid-cols-[0.95fr,1.05fr]">
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                Evolucao diaria do KM/L
              </div>
              <div className="mt-3 h-64">
                {dashboard.trends.kml.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={dashboard.trends.kml}>
                      <defs>
                        <linearGradient id="kml-board" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="#E2E8F0" strokeDasharray="3 3" />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} />
                      <YAxis hide />
                      <Tooltip
                        content={
                          <TrendTooltip
                            labelFormatter={(label) => `Dia ${label}`}
                            valueFormatter={(value) => `${fmtNum(value)} km/l`}
                          />
                        }
                      />
                      <Area
                        type="monotone"
                        dataKey="valor"
                        stroke="#10B981"
                        fill="url(#kml-board)"
                        strokeWidth={2.5}
                        dot={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center rounded-2xl bg-white text-sm font-semibold text-slate-400">
                    Sem base de KM/L no mes corrente.
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-3">
              {dashboard.pioresLinhas.length ? (
                dashboard.pioresLinhas.map((linha, index) => (
                  <div
                    key={linha.linha}
                    className="rounded-2xl border border-slate-200 bg-white p-4"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                          #{index + 1} pior linha do mes
                        </div>
                        <h3 className="mt-1 text-xl font-black text-slate-900">{linha.linha}</h3>
                        <p className="mt-1 text-sm font-semibold text-slate-600">
                          {fmtInt(linha.km)} km rodados com {fmtInt(linha.litros)} litros
                        </p>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-2xl bg-rose-50 px-4 py-3 text-center">
                          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-rose-600">
                            KM/L atual
                          </div>
                          <div className="mt-1 text-2xl font-black text-rose-700">
                            {fmtNum(linha.kml)}
                          </div>
                        </div>
                        <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-center">
                          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-600">
                            Meta ponderada
                          </div>
                          <div className="mt-1 text-2xl font-black text-emerald-700">
                            {linha.meta > 0 ? fmtNum(linha.meta) : "--"}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-6 text-center text-sm font-semibold text-slate-400">
                  Sem linhas suficientes para montar o ranking do mes.
                </div>
              )}
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Radar do dia"
          subtitle="Fila curta do que pede atencao imediata do gestor."
          action={
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-slate-700">
              Leitura rapida
            </span>
          }
        >
          <div className="space-y-3">
            {dashboard.alertas.map((alerta) => (
              <div
                key={alerta.titulo}
                className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4"
              >
                <div
                  className={`h-12 w-1.5 rounded-full ${
                    alerta.tone === "rose"
                      ? "bg-rose-500"
                      : alerta.tone === "amber"
                        ? "bg-amber-500"
                        : alerta.tone === "violet"
                          ? "bg-violet-500"
                          : "bg-blue-500"
                  }`}
                />
                <div className="flex-1">
                  <div className="text-sm font-black text-slate-900">{alerta.titulo}</div>
                  <div className="mt-1 text-xs font-medium text-slate-500">{alerta.detalhe}</div>
                </div>
                <div className="text-2xl font-black text-slate-900">{fmtInt(alerta.valor)}</div>
              </div>
            ))}
          </div>
        </SectionCard>
      </section>

      <div className="flex justify-center pt-1">
        <button
          type="button"
          onClick={toggleDetalhes}
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-blue-300 hover:text-blue-700"
        >
          {mostrarDetalhes
            ? "Ocultar detalhes"
            : "Mostrar mais detalhes (instrutores, ferias, avarias, tratativas)"}
        </button>
      </div>

      {mostrarDetalhes && (
      <>
      <section className="grid gap-5 xl:grid-cols-3">
        <SectionCard
          title="Instrutores do mes"
          subtitle="Somente instrutores identificados na base atual de Maio."
        >
          <div className="space-y-3">
            {dashboard.instrutores.length ? (
              dashboard.instrutores.map((instrutor) => (
                <div
                  key={instrutor.instrutor_nome}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-base font-black text-slate-900">
                        {instrutor.instrutor_nome}
                      </div>
                      <div className="mt-1 text-sm text-slate-500">
                        {fmtInt(instrutor.linhas)} linhas cobertas · media de{" "}
                        {fmtNum(instrutor.media_minutos)} min
                      </div>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-3">
                      <div className="rounded-xl bg-white px-3 py-2 text-center shadow-sm">
                        <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                          Acomp.
                        </div>
                        <div className="mt-1 text-lg font-black text-slate-900">
                          {fmtInt(instrutor.total_acompanhamentos)}
                        </div>
                      </div>
                      <div className="rounded-xl bg-white px-3 py-2 text-center shadow-sm">
                        <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                          Concl.
                        </div>
                        <div className="mt-1 text-lg font-black text-emerald-600">
                          {fmtInt(instrutor.concluidos)}
                        </div>
                      </div>
                      <div className="rounded-xl bg-white px-3 py-2 text-center shadow-sm">
                        <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                          Abertos
                        </div>
                        <div className="mt-1 text-lg font-black text-amber-600">
                          {fmtInt(instrutor.em_aberto)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-6 text-center text-sm font-semibold text-slate-400">
                Nenhum instrutor identificado no mes atual.
              </div>
            )}
          </div>
        </SectionCard>

        <SectionCard
          title="Ferias e cobertura"
          subtitle="Movimento de pessoas que impacta a operacao neste mes."
        >
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-violet-50 px-4 py-3">
                <div className="text-[10px] font-black uppercase tracking-[0.16em] text-violet-600">
                  Em gozo
                </div>
                <div className="mt-1 text-2xl font-black text-violet-800">
                  {fmtInt(dashboard.ferias.emGozo)}
                </div>
              </div>
              <div className="rounded-2xl bg-emerald-50 px-4 py-3">
                <div className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-600">
                  Programadas
                </div>
                <div className="mt-1 text-2xl font-black text-emerald-800">
                  {fmtInt(dashboard.ferias.programadasMes)}
                </div>
              </div>
              <div className="rounded-2xl bg-rose-50 px-4 py-3">
                <div className="text-[10px] font-black uppercase tracking-[0.16em] text-rose-600">
                  Vencidas
                </div>
                <div className="mt-1 text-2xl font-black text-rose-800">
                  {fmtInt(dashboard.ferias.vencidas)}
                </div>
              </div>
            </div>

            <div className="h-56 rounded-2xl border border-slate-200 bg-slate-50 p-3">
              {dashboard.trends.ferias.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dashboard.trends.ferias}>
                    <defs>
                      <linearGradient id="ferias-board" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#7C3AED" stopOpacity={0.28} />
                        <stop offset="95%" stopColor="#7C3AED" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#E2E8F0" strokeDasharray="3 3" />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} />
                    <YAxis hide />
                    <Tooltip
                      content={
                        <TrendTooltip
                          labelFormatter={(label) => `Dia ${label}`}
                          valueFormatter={(value) => `${fmtInt(value)} colaboradores`}
                        />
                      }
                    />
                    <Area
                      type="monotone"
                      dataKey="valor"
                      stroke="#7C3AED"
                      fill="url(#ferias-board)"
                      strokeWidth={2.5}
                      dot={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-sm font-semibold text-slate-400">
                  Sem movimentacao de ferias para mostrar agora.
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
              {fmtInt(dashboard.ferias.alerta11)} colaborador(es) estao em alerta de 11 meses.
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Servicos embarcados em aberto"
          subtitle="Backlog atual de reparos para o gestor acompanhar de perto."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-slate-50 p-4">
              <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                Abertos agora
              </div>
              <div className="mt-1 text-3xl font-black text-slate-900">
                {fmtInt(dashboard.embarcados.abertas)}
              </div>
              <div className="mt-2 text-sm font-semibold text-rose-600">
                {fmtInt(dashboard.embarcados.criticas)} criticos
              </div>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                Em execucao
              </div>
              <div className="mt-1 text-3xl font-black text-slate-900">
                {fmtInt(dashboard.embarcados.emExecucao)}
              </div>
              <div className="mt-2 text-sm font-semibold text-amber-600">
                {fmtInt(dashboard.embarcados.agPecas)} aguardando pecas
              </div>
            </div>
          </div>

          <div className="mt-4 h-56 rounded-2xl border border-slate-200 bg-slate-50 p-3">
            {embarcadosStatusChart.some((item) => item.valor > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={embarcadosStatusChart}>
                  <CartesianGrid stroke="#E2E8F0" strokeDasharray="3 3" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} />
                  <YAxis hide />
                  <Tooltip
                    content={
                      <TrendTooltip
                        labelFormatter={(label) => label}
                        valueFormatter={(value) => `${fmtInt(value)} servicos`}
                      />
                    }
                  />
                  <Bar dataKey="valor" fill="#334155" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm font-semibold text-slate-400">
                Sem servicos em aberto na base atual.
              </div>
            )}
          </div>
        </SectionCard>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <SectionCard
          title="Pulso de cobranca das avarias"
          subtitle="Percentual historico de recuperacao e fila financeira aberta."
        >
          <div className="space-y-5">
            <ProgressRow
              label="Avarias cobradas"
              value={dashboard.avarias.cobradas}
              total={dashboard.avarias.elegiveis}
              detail={`${fmtCurrency(dashboard.avarias.valorCobrado)} recuperados`}
              tone="emerald"
            />
            <ProgressRow
              label="Avarias pendentes"
              value={dashboard.avarias.pendentes}
              total={dashboard.avarias.elegiveis}
              detail="Ainda sem encerramento financeiro"
              tone="amber"
            />
            <ProgressRow
              label="Avarias canceladas"
              value={dashboard.avarias.canceladas}
              total={dashboard.avarias.elegiveis}
              detail={`${fmtCurrency(dashboard.avarias.valorTotal)} no historico elegivel`}
              tone="rose"
            />
          </div>
        </SectionCard>

        <SectionCard
          title="Pulso das tratativas"
          subtitle="Entrega historica, backlog e envelhecimento para leitura gerencial."
        >
          <div className="space-y-5">
            <ProgressRow
              label="Tratativas concluidas"
              value={dashboard.tratativas.concluidas}
              total={dashboard.tratativas.total}
              detail="Encerradas ou resolvidas"
              tone="emerald"
            />
            <ProgressRow
              label="Tratativas pendentes"
              value={dashboard.tratativas.pendentes}
              total={dashboard.tratativas.total}
              detail="Ainda aguardando acao"
              tone="amber"
            />
            <ProgressRow
              label="Tratativas atrasadas"
              value={dashboard.tratativas.atrasadas}
              total={dashboard.tratativas.total}
              detail="Pendentes ha mais de 10 dias"
              tone="rose"
            />
          </div>
        </SectionCard>
      </section>
      </>
      )}
    </div>
  );
}
