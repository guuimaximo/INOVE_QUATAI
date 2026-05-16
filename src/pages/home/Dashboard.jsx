import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  FaBus,
  FaChartLine,
  FaClipboardCheck,
  FaExclamationTriangle,
  FaGasPump,
  FaRoad,
  FaSyncAlt,
  FaTools,
  FaUserCheck,
  FaUsers,
} from "react-icons/fa";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../supabase";

const SUPABASE_A_URL = import.meta.env.VITE_SUPA_BASE_BCNT_URL;
const SUPABASE_A_ANON_KEY = import.meta.env.VITE_SUPA_BASE_BCNT_ANON_KEY;

const supabaseA =
  SUPABASE_A_URL && SUPABASE_A_ANON_KEY
    ? createClient(SUPABASE_A_URL, SUPABASE_A_ANON_KEY)
    : null;

function n(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
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

function formatMonthLabel(ym) {
  if (!ym) return "-";
  const [year, month] = ym.split("-").map(Number);
  if (!year || !month) return ym;
  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
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

function KpiCard({ title, value, sub, meta, icon, tone = "blue" }) {
  const tones = {
    blue: "from-blue-50 via-cyan-50 to-white border-blue-200 text-blue-700",
    emerald: "from-emerald-50 via-teal-50 to-white border-emerald-200 text-emerald-700",
    amber: "from-amber-50 via-orange-50 to-white border-amber-200 text-amber-700",
    rose: "from-rose-50 via-pink-50 to-white border-rose-200 text-rose-700",
  };

  return (
    <article className={`rounded-3xl border bg-gradient-to-br ${tones[tone]} p-5 shadow-sm`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] opacity-80">{title}</p>
          <p className="mt-3 text-3xl font-black text-slate-900">{value}</p>
          <p className="mt-2 text-sm font-semibold text-slate-700">{sub}</p>
          {meta ? <p className="mt-1 text-xs font-semibold text-slate-500">{meta}</p> : null}
        </div>
        <div className="rounded-2xl bg-white/80 p-3 text-xl shadow-sm">{icon}</div>
      </div>
    </article>
  );
}

function MiniStatCard({ title, value, detail, icon, tone = "slate" }) {
  const tones = {
    slate: "border-slate-200 bg-slate-50 text-slate-700",
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
  };

  return (
    <div className={`rounded-2xl border p-4 ${tones[tone]}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] opacity-80">{title}</p>
          <p className="mt-2 text-2xl font-black text-slate-900">{value}</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">{detail}</p>
        </div>
        <div className="mt-1 text-lg opacity-80">{icon}</div>
      </div>
    </div>
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

function ProgressRow({ label, value, total, tone = "blue", detail }) {
  const percent = total > 0 ? (value / total) * 100 : 0;
  const tones = {
    blue: "bg-blue-500",
    emerald: "bg-emerald-500",
    amber: "bg-amber-500",
    rose: "bg-rose-500",
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
  },
  pulso: {
    acompanhamentosMes: 0,
    instrutoresMes: 0,
    acompanhamentosAtivos: 0,
    avariasPendentes: 0,
    tratativasPendentes: 0,
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
};

export default function Dashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [dashboard, setDashboard] = useState(EMPTY_STATE);

  const referenciaMes = useMemo(() => todayYMD_SP().slice(0, 7), []);

  useEffect(() => {
    let ativo = true;

    async function carregarDashboard() {
      setLoading(true);
      setErro("");

      try {
        const { start, end } = monthRange(referenciaMes);

        const [
          premiacaoMes,
          kmRodadoMes,
          sosMes,
          avarias,
          tratativasTotalResp,
          tratativasConcluidasResp,
          tratativasPendentesResp,
          tratativasAtrasadasResp,
          acompanhamentosMes,
          sessoesMes,
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
            supabase.from("km_rodado_diario").select("data, km_total").gte("data", start).lte("data", end),
            "data"
          ),
          fetchAllRows(
            supabase.from("sos_acionamentos").select("id, data_sos, ocorrencia").gte("data_sos", start).lte("data_sos", end),
            "data_sos"
          ),
          fetchAllRows(
            supabase
              .from("avarias")
              .select("id, status_cobranca, valor_total_orcamento, valor_cobrado"),
            "id"
          ),
          supabase.from("tratativas").select("id", { count: "exact", head: true }),
          supabase
            .from("tratativas")
            .select("id", { count: "exact", head: true })
            .or("status.ilike.%conclu%,status.ilike.%resolvid%"),
          supabase
            .from("tratativas")
            .select("id", { count: "exact", head: true })
            .ilike("status", "%pendente%"),
          supabase
            .from("tratativas")
            .select("id", { count: "exact", head: true })
            .ilike("status", "%pendente%")
            .lt(
              "created_at",
              new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
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
          .filter((row) => row.dia && row.km > 0 && row.litros > 0 && row.kml >= 1.5 && row.kml <= 5);

        const kmMes = premiacaoNormalizada.reduce((acc, row) => acc + row.km, 0);
        const litrosMes = premiacaoNormalizada.reduce((acc, row) => acc + row.litros, 0);
        const kmlMes = litrosMes > 0 ? kmMes / litrosMes : 0;

        const linhasMap = new Map();
        premiacaoNormalizada.forEach((row) => {
          if (!linhasMap.has(row.linha)) {
            linhasMap.set(row.linha, {
              linha: row.linha,
              km: 0,
              litros: 0,
              litrosIdeais: 0,
            });
          }
          const item = linhasMap.get(row.linha);
          item.km += row.km;
          item.litros += row.litros;
          item.litrosIdeais += row.litrosIdeais;
        });

        const pioresLinhas = [...linhasMap.values()]
          .map((item) => ({
            ...item,
            kml: item.litros > 0 ? item.km / item.litros : 0,
            meta: item.litrosIdeais > 0 ? item.km / item.litrosIdeais : 0,
          }))
          .filter((item) => item.km > 0 && item.litros > 0)
          .sort((a, b) => a.kml - b.kml)
          .slice(0, 3);

        const mkbfKm = (kmRodadoMes || []).reduce((acc, row) => acc + n(row.km_total), 0);
        const mkbfOcorrencias = (sosMes || []).reduce((acc, row) => {
          return acc + (isOcorrenciaValidaParaMKBF(row.ocorrencia) ? 1 : 0);
        }, 0);
        const mkbf = mkbfOcorrencias > 0 ? mkbfKm / mkbfOcorrencias : 0;

        const avariasRows = avarias || [];
        const avariasElegiveis = avariasRows.filter((row) =>
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

        const tratativasTotal = tratativasTotalResp.count || 0;
        const tratativasConcluidas = tratativasConcluidasResp.count || 0;
        const tratativasPendentes = tratativasPendentesResp.count || 0;
        const tratativasAtrasadas = tratativasAtrasadasResp.count || 0;
        const tratativasPct =
          tratativasTotal > 0 ? (tratativasConcluidas / tratativasTotal) * 100 : 0;

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
              String(sessao?.instrutor_login || "").trim() ||
              "Sem instrutor",
            duracao_min: getSessionDurationMinutes(sessao),
          });
        });

        const registrosInstrutor = [];
        (acompanhamentosMes || []).forEach((acompanhamento) => {
          const sessoes = sessoesPorAcompanhamento.get(acompanhamento.id) || [];
          const linha = getLinhaFocoAcompanhamento(acompanhamento);
          const status = statusNorm(acompanhamento.status);

          if (sessoes.length) {
            sessoes.forEach((sessao) => {
              registrosInstrutor.push({
                instrutor_nome: sessao.instrutor_nome,
                data_ref: sessao.data_ref || safeDateStr(acompanhamento.dt_inicio_monitoramento) || safeDateStr(acompanhamento.created_at),
                duracao_min: sessao.duracao_min,
                linha,
                status,
              });
            });
            return;
          }

          registrosInstrutor.push({
            instrutor_nome:
              String(acompanhamento?.instrutor_nome || "").trim() ||
              String(acompanhamento?.instrutor_login || "").trim() ||
              "Sem instrutor",
            data_ref:
              safeDateStr(acompanhamento.dt_inicio_monitoramento) ||
              safeDateStr(acompanhamento.created_at),
            duracao_min: 0,
            linha,
            status,
          });
        });

        const instrutoresMap = new Map();
        registrosInstrutor.forEach((registro) => {
          const key = String(registro.instrutor_nome || "Sem instrutor").trim() || "Sem instrutor";
          if (!instrutoresMap.has(key)) {
            instrutoresMap.set(key, {
              instrutor_nome: key,
              total_acompanhamentos: 0,
              concluidos: 0,
              em_aberto: 0,
              total_minutos: 0,
              linhas: new Set(),
            });
          }

          const item = instrutoresMap.get(key);
          item.total_acompanhamentos += 1;
          item.total_minutos += n(registro.duracao_min);
          if (["OK", "ENCERRADO", "ATAS"].includes(registro.status)) {
            item.concluidos += 1;
          } else {
            item.em_aberto += 1;
          }
          if (registro.linha) item.linhas.add(registro.linha);
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
          },
          pulso: {
            acompanhamentosMes: registrosInstrutor.length,
            instrutoresMes: instrutoresMap.size,
            acompanhamentosAtivos,
            avariasPendentes: avariasPendentes.length,
            tratativasPendentes,
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
        });
      } catch (error) {
        console.error("Erro ao carregar painel executivo:", error);
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
  }, [referenciaMes]);

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-blue-600">
              Painel executivo
            </p>
            <h1 className="mt-3 text-3xl font-black text-slate-900">Dashboard do gestor</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              Leitura rapida do que esta puxando a operacao agora: consumo, intervencoes,
              cobrancas e capacidade de acompanhamento.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
                Periodo base
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
            Base diesel + SOS + avarias + tratativas
          </span>
        </div>
      </section>

      {erro ? (
        <section className="rounded-3xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">
          {erro}
        </section>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-4">
        <KpiCard
          title="KM/L do mes"
          value={loading ? "--" : fmtNum(dashboard.kpis.kmlMes)}
          sub={loading ? "Calculando..." : `${fmtInt(dashboard.kpis.kmMes)} km rodados no mes`}
          meta={loading ? "" : `${fmtInt(dashboard.kpis.litrosMes)} L consumidos`}
          icon={<FaGasPump className="text-emerald-600" />}
          tone="emerald"
        />
        <KpiCard
          title="MKBF"
          value={loading ? "--" : fmtNum(dashboard.kpis.mkbf)}
          sub={
            loading
              ? "Calculando..."
              : `${fmtInt(dashboard.kpis.mkbfOcorrencias)} ocorrencias validas no mes`
          }
          meta={loading ? "" : `${fmtInt(dashboard.kpis.mkbfKm)} km na base SOS`}
          icon={<FaRoad className="text-blue-600" />}
          tone="blue"
        />
        <KpiCard
          title="% cobranca de avaria"
          value={loading ? "--" : fmtPercent(dashboard.kpis.avariasPct)}
          sub={
            loading
              ? "Calculando..."
              : `${fmtCurrency(dashboard.kpis.avariasValorCobrado)} ja cobrados`
          }
          meta={
            loading
              ? ""
              : `${fmtCurrency(dashboard.kpis.avariasValorTotal)} no historico elegivel`
          }
          icon={<FaClipboardCheck className="text-amber-600" />}
          tone="amber"
        />
        <KpiCard
          title="Tratativas resolvidas"
          value={loading ? "--" : fmtPercent(dashboard.kpis.tratativasPct)}
          sub={
            loading
              ? "Calculando..."
              : `${fmtInt(dashboard.kpis.tratativasConcluidas)} concluidas`
          }
          meta={loading ? "" : `${fmtInt(dashboard.kpis.tratativasTotal)} tratativas no historico`}
          icon={<FaTools className="text-rose-600" />}
          tone="rose"
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        <MiniStatCard
          title="Acompanhamentos do mes"
          value={loading ? "--" : fmtInt(dashboard.pulso.acompanhamentosMes)}
          detail="Base de instrutores e sessoes registradas"
          icon={<FaUserCheck />}
          tone="blue"
        />
        <MiniStatCard
          title="Instrutores acionados"
          value={loading ? "--" : fmtInt(dashboard.pulso.instrutoresMes)}
          detail="Quantos instrutores participaram do mes"
          icon={<FaUsers />}
          tone="emerald"
        />
        <MiniStatCard
          title="Avarias pendentes"
          value={loading ? "--" : fmtInt(dashboard.pulso.avariasPendentes)}
          detail="Ainda sem cobranca concluida"
          icon={<FaExclamationTriangle />}
          tone="amber"
        />
        <MiniStatCard
          title="Tratativas pendentes"
          value={loading ? "--" : fmtInt(dashboard.pulso.tratativasPendentes)}
          detail={`${loading ? "--" : fmtInt(dashboard.pulso.acompanhamentosAtivos)} acompanhamentos ainda abertos`}
          icon={<FaSyncAlt />}
          tone="slate"
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.1fr,0.9fr]">
        <SectionCard
          title="KM/L em alerta"
          subtitle="As 3 linhas com pior resultado de KM/L no mes corrente."
          action={
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-emerald-700">
              Piores 3 linhas
            </span>
          }
        >
          <div className="space-y-3">
            {loading ? (
              <p className="text-sm font-medium text-slate-500">Carregando desempenho por linha...</p>
            ) : dashboard.pioresLinhas.length ? (
              dashboard.pioresLinhas.map((linha, index) => (
                <div
                  key={linha.linha}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                        #{index + 1} pior linha
                      </p>
                      <h3 className="mt-1 text-xl font-black text-slate-900">{linha.linha}</h3>
                      <p className="mt-1 text-sm font-semibold text-slate-600">
                        {fmtInt(linha.km)} km rodados com {fmtInt(linha.litros)} litros
                      </p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl bg-white px-4 py-3 text-center shadow-sm">
                        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
                          KM/L atual
                        </p>
                        <p className="mt-1 text-2xl font-black text-rose-600">
                          {fmtNum(linha.kml)}
                        </p>
                      </div>
                      <div className="rounded-2xl bg-white px-4 py-3 text-center shadow-sm">
                        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
                          Meta ponderada
                        </p>
                        <p className="mt-1 text-2xl font-black text-emerald-600">
                          {linha.meta > 0 ? fmtNum(linha.meta) : "--"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm font-medium text-slate-500">
                Sem base suficiente de KM/L para montar o ranking do mes.
              </p>
            )}
          </div>
        </SectionCard>

        <SectionCard
          title="Instrutores em campo"
          subtitle="Quantidade de acompanhamentos contabilizados por instrutor no mes."
          action={
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-blue-700">
              Top instrutores
            </span>
          }
        >
          <div className="space-y-3">
            {loading ? (
              <p className="text-sm font-medium text-slate-500">
                Carregando acompanhamentos dos instrutores...
              </p>
            ) : dashboard.instrutores.length ? (
              dashboard.instrutores.map((instrutor) => (
                <div
                  key={instrutor.instrutor_nome}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="text-base font-black text-slate-900">
                        {instrutor.instrutor_nome}
                      </h3>
                      <p className="mt-1 text-sm font-medium text-slate-500">
                        {fmtInt(instrutor.linhas)} linhas cobertas · media de{" "}
                        {fmtNum(instrutor.media_minutos)} min por registro
                      </p>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-3">
                      <div className="rounded-2xl bg-white px-3 py-2 text-center shadow-sm">
                        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                          Acompanh.
                        </p>
                        <p className="mt-1 text-xl font-black text-slate-900">
                          {fmtInt(instrutor.total_acompanhamentos)}
                        </p>
                      </div>
                      <div className="rounded-2xl bg-white px-3 py-2 text-center shadow-sm">
                        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                          Concluidos
                        </p>
                        <p className="mt-1 text-xl font-black text-emerald-600">
                          {fmtInt(instrutor.concluidos)}
                        </p>
                      </div>
                      <div className="rounded-2xl bg-white px-3 py-2 text-center shadow-sm">
                        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                          Em aberto
                        </p>
                        <p className="mt-1 text-xl font-black text-amber-600">
                          {fmtInt(instrutor.em_aberto)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm font-medium text-slate-500">
                Nenhum acompanhamento encontrado para o mes atual.
              </p>
            )}
          </div>
        </SectionCard>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <SectionCard
          title="Pulso de cobranca das avarias"
          subtitle="Leitura historica para acompanhar volume e dinheiro recuperado."
        >
          <div className="space-y-5">
            <ProgressRow
              label="Avarias cobradas"
              value={dashboard.avarias.cobradas}
              total={dashboard.avarias.elegiveis}
              tone="emerald"
              detail={`${fmtCurrency(dashboard.avarias.valorCobrado)} cobrados`}
            />
            <ProgressRow
              label="Avarias pendentes"
              value={dashboard.avarias.pendentes}
              total={dashboard.avarias.elegiveis}
              tone="amber"
              detail="Volume ainda em aberto para cobranca"
            />
            <ProgressRow
              label="Avarias canceladas"
              value={dashboard.avarias.canceladas}
              total={dashboard.avarias.elegiveis}
              tone="rose"
              detail={`${fmtCurrency(dashboard.avarias.valorTotal)} no historico elegivel`}
            />
          </div>
        </SectionCard>

        <SectionCard
          title="Pulso de tratativas"
          subtitle="Historico consolidado para mostrar entrega, backlog e envelhecimento."
        >
          <div className="space-y-5">
            <ProgressRow
              label="Tratativas concluidas"
              value={dashboard.tratativas.concluidas}
              total={dashboard.tratativas.total}
              tone="emerald"
              detail="Encerradas ou resolvidas"
            />
            <ProgressRow
              label="Tratativas pendentes"
              value={dashboard.tratativas.pendentes}
              total={dashboard.tratativas.total}
              tone="amber"
              detail="Ainda aguardando tratativa"
            />
            <ProgressRow
              label="Tratativas atrasadas"
              value={dashboard.tratativas.atrasadas}
              total={dashboard.tratativas.total}
              tone="rose"
              detail="Pendentes ha mais de 10 dias"
            />
          </div>
        </SectionCard>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-slate-900 p-5 text-white shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-300">
              Proximo nivel do painel
            </p>
            <h2 className="mt-2 text-2xl font-black">Base pronta para seguir ampliando</h2>
            <p className="mt-2 max-w-3xl text-sm text-slate-300">
              Esse dashboard ja nasce com o eixo que voce pediu. No proximo passo, a gente pode
              plugar ranking de motoristas, mapa de linhas criticas, farol do diesel e alertas de
              pessoas sem trocar a estrutura visual de novo.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-cyan-200">
                Base KM/L
              </p>
              <p className="mt-1 text-lg font-black">{supabaseA ? "Conectada" : "Pendente"}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-cyan-200">
                Base MKBF
              </p>
              <p className="mt-1 text-lg font-black">Conectada</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-cyan-200">
                Base gestao
              </p>
              <p className="mt-1 text-lg font-black">Conectada</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
