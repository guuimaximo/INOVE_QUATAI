import { useContext, useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import {
  FaCalendarAlt,
  FaCheckCircle,
  FaChevronLeft,
  FaChevronRight,
  FaClock,
  FaDownload,
  FaExclamationTriangle,
  FaFilter,
  FaHistory,
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

const STATUS_VIEW = [
  { value: "todos", label: "Todos" },
  { value: "criticos", label: "Criticos" },
  { value: "em_gozo", label: "Em ferias" },
  { value: "programado", label: "Programados" },
  { value: "com_abono", label: "Com abono" },
  { value: "saldo", label: "Saldo pendente" },
  { value: "quitado", label: "Quitados" },
];

const VIEW_MODES = [
  { value: "gestores", label: "Gestores" },
  { value: "calendario", label: "Calendario" },
  { value: "rh", label: "RH mensal" },
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

const LEADERSHIP_LEVELS = new Set(["GERENTE", "COORDENADOR", "SUPERVISOR", "LIDER", "DIRETOR"]);
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

function excelSerialToIso(value) {
  const serial = Number(value);
  if (!Number.isFinite(serial)) return null;
  const excelEpoch = Date.UTC(1899, 11, 30);
  const millis = excelEpoch + Math.floor(serial) * 86400000;
  const date = new Date(millis);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

function parseDateInput(value) {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return excelSerialToIso(value);
  }
  const text = safeText(value);
  if (!text) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(text)) {
    const [day, month, year] = text.split("/");
    return `${year}-${month}-${day}`;
  }
  if (/^\d+(\.\d+)?$/.test(text)) {
    return excelSerialToIso(Number(text));
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

function formatMonthLabel(monthKey) {
  if (!monthKey) return "Sem mes";
  const [year, month] = monthKey.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

function monthKeyFromDate(dateValue) {
  const date = parseDateInput(dateValue);
  return date ? date.slice(0, 7) : "";
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

function dateRangeOverlapsMonth(start, end, monthKey) {
  const startDate = parseDateInput(start);
  const endDate = parseDateInput(end);
  if (!startDate || !endDate || !monthKey) return false;
  const monthStart = `${monthKey}-01`;
  const monthDate = new Date(`${monthStart}T00:00:00`);
  const nextMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1);
  const monthEnd = new Date(nextMonth.getTime() - 86400000).toISOString().slice(0, 10);
  return startDate <= monthEnd && endDate >= monthStart;
}

function getAbonoDisplayStart(item) {
  return item.programado_abono_inicio || item.proximo_inicio_abono || null;
}

function getAbonoDisplayEnd(item) {
  return item.programado_abono_fim || item.proximo_fim_abono || null;
}

function hasAbonoData(item) {
  return (
    Number(item?.dias_abono_realizados || 0) > 0 ||
    Number(item?.dias_abono_em_andamento || 0) > 0 ||
    Number(item?.dias_abono_agendados || 0) > 0 ||
    Number(item?.qtd_abonos_realizados || 0) > 0 ||
    Number(item?.qtd_abonos_em_andamento || 0) > 0 ||
    Number(item?.qtd_abonos_agendados || 0) > 0 ||
    !!parseDateInput(item?.ultimo_inicio_abono_realizado) ||
    !!parseDateInput(item?.ultimo_fim_abono_realizado) ||
    !!parseDateInput(item?.proximo_inicio_abono) ||
    !!parseDateInput(item?.proximo_fim_abono) ||
    !!parseDateInput(item?.programado_abono_inicio) ||
    !!parseDateInput(item?.programado_abono_fim) ||
    !!item?.usar_abono
  );
}

function buildCsvRowPayload(row, meta) {
  return {
    ferias_id: safeText(row.id_ferias || row.ferias_id),
    funcionario_id: safeText(row.id_funcionario || row.funcionario_id),
    nr_cracha: safeText(row.nr_cracha || row.funcionario_cracha),
    nm_funcionario: safeText(row.nm_funcionario || row.nome),
    nm_funcao: safeText(row.nm_funcao || row.funcao),
    dt_inicio_aquisitivo: parseDateInput(row.dt_inicio_aquisitivo),
    dt_fim_aquisitivo: parseDateInput(row.dt_fim_aquisitivo),
    dt_alerta_11_meses: parseDateInput(row.dt_alerta_11_meses),
    dt_limite_legal: parseDateInput(row.dt_limite_legal),
    dias_para_limite_legal: parseNullableInt(row.dias_para_limite_legal),
    qt_dias_ferias: parseNullableInt(row.qt_dias_ferias),
    dias_gozo_realizados: parseNullableInt(row.dias_gozo_realizados),
    dias_gozo_em_andamento: parseNullableInt(row.dias_gozo_em_andamento),
    dias_gozo_agendados: parseNullableInt(row.dias_gozo_agendados),
    dias_abono_realizados: parseNullableInt(row.dias_abono_realizados),
    dias_abono_em_andamento: parseNullableInt(row.dias_abono_em_andamento),
    dias_abono_agendados: parseNullableInt(row.dias_abono_agendados),
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
    qtd_abonos_realizados: parseNullableInt(row.qtd_abonos_realizados),
    qtd_abonos_em_andamento: parseNullableInt(row.qtd_abonos_em_andamento),
    qtd_abonos_agendados: parseNullableInt(row.qtd_abonos_agendados),
    ultimo_inicio_gozo_realizado: parseDateInput(row.ultimo_inicio_gozo_realizado),
    ultimo_fim_gozo_realizado: parseDateInput(row.ultimo_fim_gozo_realizado),
    proximo_inicio_gozo: parseDateInput(row.proximo_inicio_gozo),
    proximo_fim_gozo: parseDateInput(row.proximo_fim_gozo),
    ultimo_inicio_abono_realizado: parseDateInput(row.ultimo_inicio_abono_realizado),
    ultimo_fim_abono_realizado: parseDateInput(row.ultimo_fim_abono_realizado),
    proximo_inicio_abono: parseDateInput(row.proximo_inicio_abono),
    proximo_fim_abono: parseDateInput(row.proximo_fim_abono),
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
      label: "Alerta 11 meses",
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

function getManagerForArea(areaCodigo, areasByCodigo, gestorByArea) {
  let cursor = areaCodigo;
  while (cursor) {
    const area = areasByCodigo.get(cursor);
    if (!area) break;
    if (LEADERSHIP_LEVELS.has(String(area.nivel || "").toUpperCase())) {
      const gestor = gestorByArea.get(cursor);
      return {
        manager_codigo: cursor,
        manager_nome: gestor?.nome || area.titulo || "Sem gestor",
        manager_cargo: gestor?.cargo || area.subtitulo || area.nivel || "",
        manager_nivel: area.nivel || "",
      };
    }
    cursor = area.parent_codigo || null;
  }
  return {
    manager_codigo: "",
    manager_nome: "Sem gestor vinculado",
    manager_cargo: "",
    manager_nivel: "",
  };
}

function getDisplayStart(item) {
  const direct = item.programado_inicio || item.proximo_inicio_gozo || null;
  if (direct) return direct;
  const current = getCurrentGozoPeriod(item);
  return current?.inicio || null;
}

function getDisplayEnd(item) {
  const direct = item.programado_fim || item.proximo_fim_gozo || null;
  if (direct) return direct;
  const current = getCurrentGozoPeriod(item);
  return current?.fim || null;
}

function parseHistoricoGozos(historico) {
  const text = safeText(historico);
  if (!text) return [];

  return text
    .split(/(?=Periodo \d+:)/g)
    .map((chunk) => {
      const periodo = chunk.match(/Periodo\s+(\d+)/i)?.[1] || "";
      const gozo = chunk.match(/Gozo\s+(\d{2}\/\d{2}\/\d{4})\s+a\s+(\d{2}\/\d{2}\/\d{4})/i);
      const diasGozo = parseNullableInt(chunk.match(/Dias Gozo:\s*([0-9]+)/i)?.[1]);
      const abono = chunk.match(/Abono\s+(\d{2}\/\d{2}\/\d{4})\s+a\s+(\d{2}\/\d{2}\/\d{4})/i);
      const diasAbono = parseNullableInt(chunk.match(/Dias Abono:\s*([0-9]+)/i)?.[1]);
      const situacao = safeText(chunk.match(/Situacao:\s*([0-9]+)/i)?.[1]);

      return {
        periodo,
        gozoInicio: parseDateInput(gozo?.[1]),
        gozoFim: parseDateInput(gozo?.[2]),
        diasGozo,
        abonoInicio: parseDateInput(abono?.[1]),
        abonoFim: parseDateInput(abono?.[2]),
        diasAbono,
        situacao,
      };
    })
    .filter((item) => item.gozoInicio || item.abonoInicio)
    .sort((left, right) => String(right.gozoInicio || right.abonoInicio || "").localeCompare(String(left.gozoInicio || left.abonoInicio || "")));
}

function getCurrentGozoPeriod(item) {
  const hoje = parseDateInput(new Date());
  if (!hoje) return null;

  const start = parseDateInput(item.programado_inicio || item.proximo_inicio_gozo);
  const end = parseDateInput(item.programado_fim || item.proximo_fim_gozo);
  if (start && end && start <= hoje && end >= hoje) {
    return { inicio: start, fim: end, origem: "planejamento" };
  }

  if (item.resumo_status_key !== "em_gozo" && Number(item.dias_em_andamento || 0) <= 0) {
    return null;
  }

  const historico = parseHistoricoGozos(item.historico_gozos);
  const atual = historico.find((periodo) => periodo.gozoInicio && periodo.gozoFim && periodo.gozoInicio <= hoje && periodo.gozoFim >= hoje);
  if (atual) {
    return { inicio: atual.gozoInicio, fim: atual.gozoFim, origem: "historico" };
  }

  const ultimo = historico[0];
  if (ultimo?.gozoInicio && ultimo?.gozoFim) {
    return { inicio: ultimo.gozoInicio, fim: ultimo.gozoFim, origem: "historico" };
  }

  return null;
}

function getDisplayGozoForHistory(item) {
  const historico = parseHistoricoGozos(item.historico_gozos);
  const ultimo = historico[0];

  if (ultimo?.gozoInicio && ultimo?.gozoFim) {
    return `${formatDateBR(ultimo.gozoInicio)} a ${formatDateBR(ultimo.gozoFim)}`;
  }

  if (item.ultimo_inicio_gozo_realizado) {
    return `${formatDateBR(item.ultimo_inicio_gozo_realizado)} a ${formatDateBR(item.ultimo_fim_gozo_realizado)}`;
  }

  if (item.proximo_inicio_gozo) {
    return `${formatDateBR(item.proximo_inicio_gozo)} a ${formatDateBR(item.proximo_fim_gozo)}`;
  }

  return "Sem registro";
}

function compareFeriasPriority(left, right) {
  if (left.resumo_status_order !== right.resumo_status_order) {
    return left.resumo_status_order - right.resumo_status_order;
  }
  const leftLimite = parseDateInput(left.dt_limite_legal) || "9999-12-31";
  const rightLimite = parseDateInput(right.dt_limite_legal) || "9999-12-31";
  if (leftLimite !== rightLimite) return leftLimite.localeCompare(rightLimite);
  const leftInicio = parseDateInput(left.dt_inicio_aquisitivo) || "9999-12-31";
  const rightInicio = parseDateInput(right.dt_inicio_aquisitivo) || "9999-12-31";
  return leftInicio.localeCompare(rightInicio);
}

function summarizeByCollaborator(records) {
  const groups = new Map();
  for (const record of records) {
    const key = buildFuncionarioKey(record);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(record);
  }

  return Array.from(groups.values())
    .map((items) => {
      const sorted = [...items].sort(compareFeriasPriority);
      const principal = sorted[0];
      const periodosPendentes = sorted.filter((item) => Number(item.dias_pendentes_total || 0) > 0);
      const periodosCriticos = sorted.filter((item) => ["vencido", "alerta", "bloqueado"].includes(item.resumo_status_key));
      return {
        ...principal,
        _periodos_relacionados: sorted,
        _periodos_total_colaborador: sorted.length,
        _periodos_pendentes_colaborador: periodosPendentes.length,
        _periodos_criticos_colaborador: periodosCriticos.length,
        _saldo_total_colaborador: sorted.reduce((sum, item) => sum + Number(item.dias_pendentes_total || 0), 0),
        _dias_abono_total_colaborador: sorted.reduce(
          (sum, item) =>
            sum +
            Number(item.dias_abono_realizados || 0) +
            Number(item.dias_abono_em_andamento || 0) +
            Number(item.dias_abono_agendados || 0),
          0
        ),
        _qtd_abonos_total_colaborador: sorted.reduce(
          (sum, item) =>
            sum +
            Number(item.qtd_abonos_realizados || 0) +
            Number(item.qtd_abonos_em_andamento || 0) +
            Number(item.qtd_abonos_agendados || 0),
          0
        ),
        _colaborador_tem_abono: sorted.some((item) => hasAbonoData(item)),
      };
    })
    .sort(compareFeriasPriority);
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
    "Gestor",
    "Area",
    "Periodo aquisitivo",
    "Limite legal",
    "Dias pendentes",
    "Dias gozo",
    "Dias abono",
    "Status",
    "Quando pode tirar",
    "Vai tirar",
    "Abono planejado",
    "Planejamento",
    "Prioridade",
  ];
  const lines = rows.map((row) => [
    row.nm_funcionario || "",
    row.nr_cracha || "",
    row.nm_funcao || "",
    row.manager_nome || "",
    row.area_titulo || "",
    `${formatDateBR(row.dt_inicio_aquisitivo)} a ${formatDateBR(row.dt_fim_aquisitivo)}`,
    formatDateBR(row.dt_limite_legal),
    row.dias_pendentes_total || 0,
    `${Number(row.dias_gozo_realizados || 0)}/${Number(row.qt_dias_ferias || 0)}`,
    `${Number(row.dias_abono_realizados || 0)}${hasAbonoData(row) ? " dia(s)" : ""}`,
    row.resumo_status_label,
    row.janela_sugerida_inicio || row.janela_sugerida_fim
      ? `${formatDateBR(row.janela_sugerida_inicio)} a ${formatDateBR(row.janela_sugerida_fim)}`
      : "",
    getDisplayStart(row)
      ? `${formatDateBR(getDisplayStart(row))} a ${formatDateBR(getDisplayEnd(row))}`
      : "",
    getAbonoDisplayStart(row)
      ? `${formatDateBR(getAbonoDisplayStart(row))} a ${formatDateBR(getAbonoDisplayEnd(row))}`
      : row.usar_abono
        ? "Sim"
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
  const [showHistorico, setShowHistorico] = useState(false);
  const [form, setForm] = useState({
    janela_sugerida_inicio: "",
    janela_sugerida_fim: "",
    programado_inicio: "",
    programado_fim: "",
    usar_abono: false,
    programado_abono_inicio: "",
    programado_abono_fim: "",
    status_planejamento: "ANALISAR",
    prioridade: "MEDIA",
    observacoes: "",
  });

  useEffect(() => {
    if (!open || !item) return;
    setShowHistorico(false);
    setForm({
      janela_sugerida_inicio: item.janela_sugerida_inicio || "",
      janela_sugerida_fim: item.janela_sugerida_fim || "",
      programado_inicio: item.programado_inicio || item.proximo_inicio_gozo || "",
      programado_fim: item.programado_fim || item.proximo_fim_gozo || "",
      usar_abono: Boolean(item.usar_abono || hasAbonoData(item)),
      programado_abono_inicio: item.programado_abono_inicio || item.proximo_inicio_abono || "",
      programado_abono_fim: item.programado_abono_fim || item.proximo_fim_abono || "",
      status_planejamento: item.status_planejamento || (item.resumo_status_key === "vencido" ? "PODE_PROGRAMAR" : "ANALISAR"),
      prioridade: item.prioridade || (item.resumo_status_key === "vencido" ? "ALTA" : "MEDIA"),
      observacoes: item.observacoes || "",
    });
  }, [item, open]);

  if (!open || !item) return null;

  const currentGozoPeriod = getCurrentGozoPeriod(item);
  const historicoPeriodos = (item._periodos_relacionados?.length ? item._periodos_relacionados : [item])
    .map((periodo) => ({
      ...periodo,
      _historico_extraido: parseHistoricoGozos(periodo.historico_gozos),
    }))
    .sort((left, right) => String(right.dt_inicio_aquisitivo || "").localeCompare(String(left.dt_inicio_aquisitivo || "")));

  const diasPlanejados = diffDaysInclusive(form.programado_inicio, form.programado_fim);
  const diasAbonoPlanejados = form.usar_abono ? diffDaysInclusive(form.programado_abono_inicio, form.programado_abono_fim) : 0;
  const totalPlanejado = Number(diasPlanejados || 0) + Number(diasAbonoPlanejados || 0);
  const saldoPendente = Number(item.dias_pendentes_total || 0);
  const mismatchDias = totalPlanejado > 0 && saldoPendente > 0 && totalPlanejado !== saldoPendente;

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-[2px]">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-blue-50 shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-200 bg-white/80 px-6 py-4 backdrop-blur">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-blue-600">Card do colaborador</div>
            <div className="mt-1 text-xl font-black text-slate-900">{item.nm_funcionario}</div>
            <div className="text-sm text-slate-500">
              {item.nm_funcao || "Sem funcao"}
              {item.manager_nome ? ` • Gestor: ${item.manager_nome}` : ""}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowHistorico((current) => !current)}
              className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                showHistorico
                  ? "border-blue-200 bg-blue-50 text-blue-800"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              <FaHistory />
              Historico
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            >
              <FaTimes />
            </button>
          </div>
        </div>

        <div className="grid flex-1 grid-cols-1 gap-5 overflow-y-auto px-6 py-5 lg:grid-cols-[1.1fr_1.3fr]">
          <div className="space-y-4">
            {currentGozoPeriod ? (
              <div className="rounded-2xl border border-purple-200 bg-gradient-to-r from-purple-50 via-fuchsia-50 to-blue-50 p-4">
                <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-purple-700">Em ferias agora</div>
                <div className="mt-1 text-lg font-black text-slate-900">
                  {formatDateBR(currentGozoPeriod.inicio)} a {formatDateBR(currentGozoPeriod.fim)}
                </div>
              </div>
            ) : null}

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <InfoBox label="Cracha" value={item.nr_cracha} />
              <InfoBox label="Status atual" value={item.resumo_status_label} />
              <InfoBox label="Gestor" value={item.manager_nome} />
              <InfoBox label="Area" value={item.area_titulo} />
              <InfoBox
                label="Periodo aquisitivo"
                value={`${formatDateBR(item.dt_inicio_aquisitivo)} a ${formatDateBR(item.dt_fim_aquisitivo)}`}
              />
              <InfoBox label="Limite legal" value={formatDateBR(item.dt_limite_legal)} />
              <InfoBox label="Dias pendentes" value={formatInt(item.dias_pendentes_total)} />
              <InfoBox label="Dias em andamento" value={formatInt(item.dias_em_andamento)} />
              <InfoBox label="Gozo" value={`${formatInt(item.dias_gozo_realizados || 0)} dia(s)`} />
              <InfoBox label="Abono" value={`${formatInt(item.dias_abono_realizados || 0)} dia(s)`} />
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Resumo rapido</div>
                <div className="mt-2 space-y-1 text-sm text-slate-600">
                  <div><span className="font-semibold text-slate-800">Saldo total:</span> {formatInt(item._saldo_total_colaborador || item.dias_pendentes_total || 0)} dia(s)</div>
                  <div><span className="font-semibold text-slate-800">Periodos pendentes:</span> {formatInt(item._periodos_pendentes_colaborador || 0)}</div>
                  <div><span className="font-semibold text-slate-800">Ultimo gozo:</span> {getDisplayGozoForHistory(item)}</div>
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Abono</div>
                <div className="mt-2 space-y-1 text-sm text-slate-600">
                  <div><span className="font-semibold text-slate-800">Dias:</span> {formatInt(item._dias_abono_total_colaborador || 0)} dia(s)</div>
                  <div><span className="font-semibold text-slate-800">Ocorrencias:</span> {formatInt(item._qtd_abonos_total_colaborador || 0)}</div>
                  <div>
                    <span className="font-semibold text-slate-800">Ultimo abono:</span>{" "}
                    {item.ultimo_inicio_abono_realizado
                      ? `${formatDateBR(item.ultimo_inicio_abono_realizado)} a ${formatDateBR(item.ultimo_fim_abono_realizado)}`
                      : "Sem registro"}
                  </div>
                </div>
              </div>
            </div>

            {showHistorico ? (
              <div className="rounded-2xl border border-blue-200 bg-white p-4">
                <div className="flex items-center gap-2 text-sm font-black uppercase tracking-wide text-blue-900">
                  <FaHistory />
                  Historico
                </div>
                <div className="mt-3 space-y-2">
                  {historicoPeriodos.map((periodo) => {
                    const ultimoHistorico = periodo._historico_extraido?.[0];
                    const gozoTexto = ultimoHistorico?.gozoInicio
                      ? `${formatDateBR(ultimoHistorico.gozoInicio)} a ${formatDateBR(ultimoHistorico.gozoFim)}`
                      : getDisplayGozoForHistory(periodo);
                    const diasTexto = formatInt(ultimoHistorico?.diasGozo ?? periodo.dias_gozo_realizados ?? 0);
                    const abonoTexto = ultimoHistorico?.abonoInicio
                      ? `${formatDateBR(ultimoHistorico.abonoInicio)} a ${formatDateBR(ultimoHistorico.abonoFim)}`
                      : hasAbonoData(periodo)
                        ? `${formatInt(periodo.dias_abono_realizados || 0)} dia(s)`
                        : "Sem abono";
                    return (
                      <div key={periodo.ferias_id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                        <div className="grid grid-cols-1 gap-2 md:grid-cols-[1.3fr_0.7fr_1fr] md:items-center">
                          <div>
                            <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Quando foi</div>
                            <div className="mt-1 text-sm font-bold text-slate-900">{gozoTexto}</div>
                          </div>
                          <div>
                            <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Quantos dias</div>
                            <div className="mt-1 text-sm font-bold text-slate-900">{diasTexto} dia(s)</div>
                          </div>
                          <div>
                            <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Abono</div>
                            <div className="mt-1 text-sm font-semibold text-slate-700">{abonoTexto}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-blue-100 bg-blue-50/50 px-4 py-3">
              <div className="text-sm font-black uppercase tracking-wide text-blue-900">Preenchimento rapido</div>
              <div className="mt-2 text-sm text-slate-700">
                <span className="font-semibold text-blue-900">Pode liberar:</span> janela que a equipe suporta.
                {" "} <span className="font-semibold text-emerald-900">Vai tirar:</span> periodo confirmado.
                {" "} <span className="font-semibold text-amber-900">Abono:</span> quando houver venda de dias.
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field
                label="Pode liberar - inicio"
                hint="Primeiro dia em que a equipe consegue liberar esse colaborador."
              >
                <input
                  className={FIELD_INPUT}
                  type="date"
                  value={form.janela_sugerida_inicio}
                  onChange={(event) => updateField("janela_sugerida_inicio", event.target.value)}
                />
              </Field>
              <Field
                label="Pode liberar - fim"
                hint="Ultimo dia dessa janela possivel."
              >
                <input
                  className={FIELD_INPUT}
                  type="date"
                  value={form.janela_sugerida_fim}
                  onChange={(event) => updateField("janela_sugerida_fim", event.target.value)}
                />
              </Field>
              <Field
                label="Ferias confirmadas - inicio"
                hint="Data real que ficou combinada."
              >
                <input
                  className={FIELD_INPUT}
                  type="date"
                  value={form.programado_inicio}
                  onChange={(event) => updateField("programado_inicio", event.target.value)}
                />
              </Field>
              <Field
                label="Ferias confirmadas - fim"
                hint="Ultimo dia confirmado de gozo."
              >
                <input
                  className={FIELD_INPUT}
                  type="date"
                  value={form.programado_fim}
                  onChange={(event) => updateField("programado_fim", event.target.value)}
                />
              </Field>
              <Field label="Planejar com abono">
                <select
                  className={FIELD_INPUT}
                  value={form.usar_abono ? "SIM" : "NAO"}
                  onChange={(event) => updateField("usar_abono", event.target.value === "SIM")}
                >
                  <option value="NAO">Nao</option>
                  <option value="SIM">Sim</option>
                </select>
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

            {form.usar_abono ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field label="Abono - inicio">
                  <input
                    className={FIELD_INPUT}
                    type="date"
                    value={form.programado_abono_inicio}
                    onChange={(event) => updateField("programado_abono_inicio", event.target.value)}
                  />
                </Field>
                <Field label="Abono - fim">
                  <input
                    className={FIELD_INPUT}
                    type="date"
                    value={form.programado_abono_fim}
                    onChange={(event) => updateField("programado_abono_fim", event.target.value)}
                  />
                </Field>
              </div>
            ) : null}

            {item.proximo_inicio_gozo || item.proximo_inicio_abono ? (
              <button
                type="button"
                onClick={() =>
                  setForm((current) => ({
                    ...current,
                    programado_inicio: item.proximo_inicio_gozo || "",
                    programado_fim: item.proximo_fim_gozo || "",
                    usar_abono: Boolean(item.proximo_inicio_abono || item.proximo_fim_abono || current.usar_abono),
                    programado_abono_inicio: item.proximo_inicio_abono || "",
                    programado_abono_fim: item.proximo_fim_abono || "",
                  }))
                }
                className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100"
              >
                <FaCalendarAlt />
                Usar agenda vinda da base
              </button>
            ) : null}

            <Field
              label="Observacoes do gestor"
              hint="Ex.: nao pode sair junto com fulano, equipe reduzida, cobertura do turno confirmada."
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
                  ? `Gozo planejado: ${diasPlanejados} dia(s)${form.usar_abono ? ` | Abono planejado: ${Number(diasAbonoPlanejados || 0)} dia(s) | Total: ${totalPlanejado} dia(s)` : ""}.`
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

function ManagerSummary({ groups, selectedManager, onSelectManager }) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
      {groups.map((group) => (
        <button
          key={group.manager_codigo || group.manager_nome}
          type="button"
          onClick={() => onSelectManager(group.manager_nome === selectedManager ? "" : group.manager_nome)}
          className={`rounded-2xl border p-4 text-left transition ${
            group.manager_nome === selectedManager
              ? "border-blue-400 bg-blue-50 shadow-sm"
              : "border-slate-200 bg-white hover:border-blue-200 hover:bg-slate-50"
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-black uppercase tracking-wide text-slate-900">{group.manager_nome}</div>
              <div className="mt-1 text-xs text-slate-500">{group.manager_cargo || "Gestor vinculado pelo organograma"}</div>
            </div>
            <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-700">
              {group.total} pessoa(s)
            </span>
          </div>
          <div className="mt-4 grid grid-cols-4 gap-2 text-center text-xs">
            <div className="rounded-xl bg-rose-50 px-2 py-2 text-rose-800">
              <div className="font-black">{group.vencidos}</div>
              <div>Vencidos</div>
            </div>
            <div className="rounded-xl bg-purple-50 px-2 py-2 text-purple-800">
              <div className="font-black">{group.emGozo}</div>
              <div>Em ferias</div>
            </div>
            <div className="rounded-xl bg-emerald-50 px-2 py-2 text-emerald-800">
              <div className="font-black">{group.programados}</div>
              <div>Planejados</div>
            </div>
            <div className="rounded-xl bg-amber-50 px-2 py-2 text-amber-800">
              <div className="font-black">{group.comAbono}</div>
              <div>Abono</div>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

function CalendarView({ registros, monthKey, onPrevMonth, onNextMonth, onOpenItem }) {
  const monthStart = new Date(`${monthKey}-01T00:00:00`);
  const firstDayIndex = monthStart.getDay();
  const daysInMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();
  const cells = [];
  const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];

  for (let index = 0; index < firstDayIndex; index += 1) {
    cells.push({ key: `blank-start-${index}`, empty: true });
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    const iso = `${monthKey}-${String(day).padStart(2, "0")}`;
    const items = registros.filter((item) => {
      const start = parseDateInput(getDisplayStart(item));
      const end = parseDateInput(getDisplayEnd(item));
      return start && end && start <= iso && end >= iso;
    });
    cells.push({ key: iso, iso, day, items });
  }
  while (cells.length % 7 !== 0) {
    cells.push({ key: `blank-end-${cells.length}`, empty: true });
  }

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-sm font-black uppercase tracking-wide text-slate-800">Calendario de ferias</div>
          <div className="mt-1 text-sm text-slate-500">Veja por dia quem esta programado ou ja entrou em gozo.</div>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={onPrevMonth} className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50">
            <FaChevronLeft />
          </button>
          <div className="min-w-[180px] text-center text-sm font-black uppercase tracking-wide text-slate-800">
            {formatMonthLabel(monthKey)}
          </div>
          <button type="button" onClick={onNextMonth} className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50">
            <FaChevronRight />
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-2 text-center text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">
        {weekDays.map((label) => (
          <div key={label}>{label}</div>
        ))}
      </div>

      <div className="mt-2 grid grid-cols-7 gap-2">
        {cells.map((cell) => (
          <div
            key={cell.key}
            className={`min-h-[112px] rounded-2xl border p-2 ${
              cell.empty ? "border-transparent bg-transparent" : "border-slate-200 bg-slate-50"
            }`}
          >
            {!cell.empty ? (
              <>
                <div className="text-sm font-black text-slate-800">{cell.day}</div>
                <div className="mt-2 space-y-1">
                  {cell.items.slice(0, 3).map((item) => (
                    <button
                      key={`${cell.iso}-${item.ferias_id}`}
                      type="button"
                      onClick={() => onOpenItem(item)}
                      className="block w-full truncate rounded-lg bg-blue-50 px-2 py-1 text-left text-[11px] font-semibold text-blue-800 hover:bg-blue-100"
                      title={`${item.nm_funcionario} - ${item.manager_nome}`}
                    >
                      {item.nm_funcionario}
                      {hasAbonoData(item) ? " • A" : ""}
                    </button>
                  ))}
                  {cell.items.length > 3 ? (
                    <div className="text-[11px] font-semibold text-slate-500">+{cell.items.length - 3} mais</div>
                  ) : null}
                </div>
              </>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function RHMonthlyView({ groups, onOpenItem }) {
  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <div key={group.monthKey} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-sm font-black uppercase tracking-wide text-slate-800">{formatMonthLabel(group.monthKey)}</div>
              <div className="mt-1 text-sm text-slate-500">{group.items.length} colaborador(es) com ferias planejadas neste mes.</div>
            </div>
            <div className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-emerald-800">
              RH
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead>
                <tr className="text-left text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">
                  <th className="px-3 py-3">Colaborador</th>
                  <th className="px-3 py-3">Gestor</th>
                  <th className="px-3 py-3">Area</th>
                  <th className="px-3 py-3">Periodo</th>
                  <th className="px-3 py-3">Abono</th>
                  <th className="px-3 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {group.items.map((item) => (
                  <tr
                    key={item.ferias_id}
                    className="cursor-pointer hover:bg-slate-50/70"
                    onClick={() => onOpenItem(item)}
                  >
                    <td className="px-3 py-3">
                      <div className="font-bold text-slate-900">{item.nm_funcionario}</div>
                      <div className="text-xs text-slate-500">{item.nm_funcao || "Sem funcao"}</div>
                    </td>
                    <td className="px-3 py-3 text-slate-700">{item.manager_nome}</td>
                    <td className="px-3 py-3 text-slate-600">{item.area_titulo || "-"}</td>
                    <td className="px-3 py-3 text-slate-700">
                      {formatDateBR(getDisplayStart(item))} a {formatDateBR(getDisplayEnd(item))}
                    </td>
                    <td className="px-3 py-3 text-slate-700">
                      {hasAbonoData(item)
                        ? getAbonoDisplayStart(item)
                          ? `${formatDateBR(getAbonoDisplayStart(item))} a ${formatDateBR(getAbonoDisplayEnd(item))}`
                          : `${formatInt(item.dias_abono_realizados || 0)} dia(s)`
                        : "-"}
                    </td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${item.resumo_status_chip}`}>
                        {item.resumo_status_label}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Ferias() {
  const { user } = useContext(AuthContext);
  const fileInputRef = useRef(null);

  const [registros, setRegistros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busca, setBusca] = useState("");
  const [statusView, setStatusView] = useState("criticos");
  const [viewMode, setViewMode] = useState("gestores");
  const [managerFilter, setManagerFilter] = useState("");
  const [funcaoFiltro, setFuncaoFiltro] = useState("");
  const [selecionado, setSelecionado] = useState(null);
  const [calendarMonth, setCalendarMonth] = useState(new Date().toISOString().slice(0, 7));

  async function carregarDados() {
    setLoading(true);

    const [periodosResp, planosResp, pessoasResp, areasResp] = await Promise.all([
      supabase.from("ferias_periodos_importados").select("*").eq("ativo", true).order("nm_funcionario", { ascending: true }),
      supabase.from("ferias_planejamento").select("*").order("atualizado_em", { ascending: false }),
      supabase
        .from("organograma_manutencao_pessoas")
        .select("funcionario_id, funcionario_cracha, nome, cargo, area_codigo, ativo, tipo_headcount")
        .eq("ativo", true)
        .eq("tipo_headcount", "REALIZADO"),
      supabase
        .from("organograma_manutencao_areas")
        .select("codigo, parent_codigo, titulo, subtitulo, nivel, ativo")
        .eq("ativo", true),
    ]);

    if (periodosResp.error) console.error(periodosResp.error);
    if (planosResp.error) console.error(planosResp.error);
    if (pessoasResp.error) console.error(pessoasResp.error);
    if (areasResp.error) console.error(areasResp.error);

    const areasByCodigo = new Map((areasResp.data || []).map((area) => [area.codigo, area]));
    const allocByKey = new Map();
    const gestorByArea = new Map();

    for (const pessoa of pessoasResp.data || []) {
      const key = buildFuncionarioKey(pessoa);
      if (key) allocByKey.set(key, pessoa);
      if (!gestorByArea.has(pessoa.area_codigo) && LEADERSHIP_LEVELS.has(String(areasByCodigo.get(pessoa.area_codigo)?.nivel || "").toUpperCase())) {
        gestorByArea.set(pessoa.area_codigo, pessoa);
      }
    }

    const merged = mergeFeriasData(periodosResp.data || [], planosResp.data || [], allocByKey, areasByCodigo, gestorByArea);
    setRegistros(merged);
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
      usar_abono: Boolean(form.usar_abono),
      programado_abono_inicio: form.usar_abono ? form.programado_abono_inicio || null : null,
      programado_abono_fim: form.usar_abono ? form.programado_abono_fim || null : null,
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

  const gestoresOptions = useMemo(() => {
    const unique = new Set();
    for (const registro of registros) {
      if (registro.manager_nome) unique.add(registro.manager_nome);
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

  const filteredPeriods = useMemo(() => {
    const query = normalizeText(busca);
    return registros
      .filter((registro) => {
        if (managerFilter && registro.manager_nome !== managerFilter) return false;
        if (funcaoFiltro && registro.nm_funcao !== funcaoFiltro) return false;
        if (statusView === "criticos" && !["vencido", "alerta", "bloqueado"].includes(registro.resumo_status_key)) return false;
        if (statusView === "em_gozo" && registro.resumo_status_key !== "em_gozo") return false;
        if (statusView === "programado" && registro.resumo_status_key !== "programado") return false;
        if (statusView === "com_abono" && !hasAbonoData(registro)) return false;
        if (statusView === "saldo" && !["saldo", "alerta", "vencido", "bloqueado"].includes(registro.resumo_status_key)) return false;
        if (statusView === "quitado" && registro.resumo_status_key !== "quitado") return false;
        if (!query) return true;
        const blob = normalizeText(
          `${registro.nm_funcionario} ${registro.nr_cracha} ${registro.nm_funcao} ${registro.area_titulo} ${registro.manager_nome} ${registro.historico_gozos} ${registro.status_periodo} ${registro.status_realizacao} ${registro.status_agendamento}`
        );
        return blob.includes(query);
      })
      .sort((left, right) => {
        if (left.resumo_status_order !== right.resumo_status_order) {
          return left.resumo_status_order - right.resumo_status_order;
        }
        return Number(left.dias_para_limite_legal || 99999) - Number(right.dias_para_limite_legal || 99999);
      });
  }, [busca, funcaoFiltro, managerFilter, registros, statusView]);

  const filteredRecords = useMemo(() => summarizeByCollaborator(filteredPeriods), [filteredPeriods]);

  const managerGroups = useMemo(() => {
    const groups = new Map();
    for (const registro of filteredRecords) {
      const key = registro.manager_codigo || registro.manager_nome || "sem-gestor";
      if (!groups.has(key)) {
          groups.set(key, {
            manager_codigo: registro.manager_codigo,
            manager_nome: registro.manager_nome,
            manager_cargo: registro.manager_cargo,
            total: 0,
            vencidos: 0,
            emGozo: 0,
            programados: 0,
            comAbono: 0,
          });
        }
      const group = groups.get(key);
      group.total += 1;
      if (registro._periodos_criticos_colaborador > 0 || registro.resumo_status_key === "vencido") group.vencidos += 1;
      if (registro.resumo_status_key === "em_gozo") group.emGozo += 1;
      if (registro.resumo_status_key === "programado") group.programados += 1;
      if (registro._colaborador_tem_abono) group.comAbono = Number(group.comAbono || 0) + 1;
    }
    return Array.from(groups.values()).sort((a, b) => {
      if (b.vencidos !== a.vencidos) return b.vencidos - a.vencidos;
      if (b.total !== a.total) return b.total - a.total;
      return String(a.manager_nome || "").localeCompare(String(b.manager_nome || ""), "pt-BR");
    });
  }, [filteredRecords]);

  const monthlyPlannedGroups = useMemo(() => {
    const groups = new Map();
    for (const item of filteredRecords) {
      const monthKey = monthKeyFromDate(getDisplayStart(item));
      if (!monthKey) continue;
      if (!groups.has(monthKey)) groups.set(monthKey, []);
      groups.get(monthKey).push(item);
    }
    return Array.from(groups.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([monthKey, items]) => ({
        monthKey,
        items: items.sort((left, right) => String(left.manager_nome || "").localeCompare(String(right.manager_nome || ""), "pt-BR")),
      }));
  }, [filteredRecords]);

  const calendarRecords = useMemo(
    () =>
      filteredPeriods.filter((item) => {
        const start = getDisplayStart(item);
        const end = getDisplayEnd(item);
        return dateRangeOverlapsMonth(start, end, calendarMonth);
      }),
    [calendarMonth, filteredPeriods]
  );

  const stats = useMemo(() => {
    const colaboradores = new Set(filteredRecords.map((registro) => `${registro.funcionario_id || registro.nr_cracha || registro.nm_funcionario}`));
    const emGozo = filteredRecords.filter((registro) => registro.resumo_status_key === "em_gozo").length;
    const programados = filteredRecords.filter((registro) => registro.resumo_status_key === "programado").length;
    const vencidos = filteredRecords.filter((registro) => registro.resumo_status_key === "vencido").length;
    const alerta11 = filteredRecords.filter((registro) => registro.resumo_status_key === "alerta").length;
    const saldo = filteredRecords.filter((registro) => ["saldo", "alerta", "vencido", "bloqueado"].includes(registro.resumo_status_key)).length;
    const comAbono = filteredRecords.filter((registro) => registro._colaborador_tem_abono).length;
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
      comAbono,
      baseAtualizadaEm,
      fonteArquivo,
    };
  }, [filteredRecords, registros]);

  const criticos = useMemo(
    () => filteredRecords.filter((registro) => ["vencido", "alerta", "bloqueado"].includes(registro.resumo_status_key)).slice(0, 8),
    [filteredRecords]
  );

  function goPrevMonth() {
    const date = new Date(`${calendarMonth}-01T00:00:00`);
    const prev = new Date(date.getFullYear(), date.getMonth() - 1, 1);
    setCalendarMonth(prev.toISOString().slice(0, 7));
  }

  function goNextMonth() {
    const date = new Date(`${calendarMonth}-01T00:00:00`);
    const next = new Date(date.getFullYear(), date.getMonth() + 1, 1);
    setCalendarMonth(next.toISOString().slice(0, 7));
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-blue-600">Pessoas</div>
          <h1 className="mt-1 text-3xl font-black text-slate-900">Ferias</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            Central para o gestor enxergar a equipe por gerente, abrir o card do colaborador e para o RH acompanhar o planejado por mes.
          </p>
        </div>

        <div className="grid w-full max-w-2xl grid-cols-1 gap-3 md:grid-cols-2">
          <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4">
            <div className="flex items-center gap-2 text-sm font-black uppercase tracking-wide text-blue-900">
              <FaCheckCircle />
              Fluxo do gestor
            </div>
            <div className="mt-3 grid grid-cols-1 gap-2 text-sm text-blue-900/90">
              <div>1. Filtra por gestor e ve os criticos.</div>
              <div>2. Abre a linha e consulta o card do colaborador.</div>
              <div>3. Registra quando pode liberar.</div>
              <div>4. Define quando vai tirar e RH acompanha por mes.</div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-sm font-black uppercase tracking-wide text-slate-700">Base oficial</div>
                <div className="mt-1 text-xs text-slate-500">
                  {stats.baseAtualizadaEm
                    ? `Atualizada em ${formatDateTimeBR(stats.baseAtualizadaEm)}`
                    : "Nenhuma base publicada ainda"}
                </div>
                {stats.fonteArquivo ? <div className="mt-1 text-xs text-slate-400">{stats.fonteArquivo}</div> : null}
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
                onClick={() => exportarCSV(filteredRecords)}
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

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-7">
        <CardKPI titulo="Colaboradores" valor={formatInt(stats.colaboradores)} cor="slate" icon={<FaUsers />} />
        <CardKPI titulo="Periodos ativos" valor={formatInt(stats.periodos)} cor="blue" icon={<FaCalendarAlt />} />
        <CardKPI titulo="Em ferias" valor={formatInt(stats.emGozo)} cor="purple" icon={<FaUserClock />} />
        <CardKPI titulo="Programados" valor={formatInt(stats.programados)} cor="emerald" icon={<FaCheckCircle />} />
        <CardKPI titulo="Vencidos" valor={formatInt(stats.vencidos)} cor="rose" icon={<FaExclamationTriangle />} />
        <CardKPI titulo="Com saldo" valor={formatInt(stats.saldo)} cor="amber" icon={<FaClock />} sub={`${formatInt(stats.alerta11)} em alerta 11 meses`} />
        <CardKPI titulo="Com abono" valor={formatInt(stats.comAbono)} cor="blue" icon={<FaCalendarAlt />} sub="Historico ou planejamento com abono" />
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-100 pb-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-sm font-black uppercase tracking-wide text-slate-800">Visao da central</div>
            <div className="mt-1 text-sm text-slate-500">Gestores para a operacao, calendario para leitura rapida e RH mensal para acompanhamento do planejado.</div>
          </div>
          <div className="flex flex-wrap gap-2">
            {VIEW_MODES.map((mode) => (
              <button
                key={mode.value}
                type="button"
                onClick={() => setViewMode(mode.value)}
                className={`rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition ${
                  viewMode === mode.value
                    ? "bg-blue-600 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {mode.label}
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
                placeholder="Nome, cracha, funcao, gestor..."
              />
            </div>
          </Field>
          <Field label="Gestor">
            <select className={FIELD_INPUT} value={managerFilter} onChange={(event) => setManagerFilter(event.target.value)}>
              <option value="">Todos</option>
              {gestoresOptions.map((option) => (
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
                setManagerFilter("");
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

        <div className="mt-4 flex flex-wrap gap-2">
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

      {viewMode === "gestores" ? (
        <div className="space-y-5">
          <ManagerSummary groups={managerGroups} selectedManager={managerFilter} onSelectManager={setManagerFilter} />

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.4fr_0.9fr]">
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-2 border-b border-slate-100 pb-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="text-sm font-black uppercase tracking-wide text-slate-800">Visao por gestor</div>
                  <div className="mt-1 text-sm text-slate-500">Clique na linha para abrir o card do colaborador.</div>
                </div>
                <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-slate-700">
                  {filteredRecords.length} colaborador(es)
                </div>
              </div>

              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead>
                    <tr className="text-left text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">
                      <th className="px-3 py-3">Colaborador</th>
                      <th className="px-3 py-3">Gestor</th>
                      <th className="px-3 py-3">Periodo</th>
                      <th className="px-3 py-3">Limite</th>
                      <th className="px-3 py-3">Saldo</th>
                      <th className="px-3 py-3">Gozo / abono</th>
                      <th className="px-3 py-3">Status</th>
                      <th className="px-3 py-3">Vai tirar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loading ? (
                      <tr>
                        <td className="px-3 py-8 text-center text-slate-500" colSpan={8}>
                          Carregando base de ferias...
                        </td>
                      </tr>
                    ) : !filteredRecords.length ? (
                      <tr>
                        <td className="px-3 py-8 text-center text-slate-500" colSpan={8}>
                          Nenhum periodo encontrado com os filtros atuais.
                        </td>
                      </tr>
                    ) : (
                      filteredRecords.map((registro) => (
                        <tr
                          key={registro.ferias_id}
                          className="cursor-pointer hover:bg-slate-50/70"
                          onClick={() => setSelecionado(registro)}
                        >
                          <td className="px-3 py-3">
                            <div className="font-bold text-slate-900">{registro.nm_funcionario || "-"}</div>
                            <div className="text-xs text-slate-500">
                              {registro.nm_funcao || "Sem funcao"}
                              {registro.area_titulo ? ` • ${registro.area_titulo}` : ""}
                            </div>
                            <div className="text-xs text-slate-400">
                              Cracha {registro.nr_cracha || "-"}
                              {registro._periodos_pendentes_colaborador > 1
                                ? ` • ${registro._periodos_pendentes_colaborador} periodos pendentes`
                                : registro._periodos_total_colaborador > 1
                                  ? ` • ${registro._periodos_total_colaborador} periodos no historico`
                                  : ""}
                            </div>
                          </td>
                          <td className="px-3 py-3 text-slate-700">
                            <div className="font-semibold">{registro.manager_nome}</div>
                            <div className="text-xs text-slate-400">{registro.manager_cargo || "-"}</div>
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
                          <td className="px-3 py-3 font-bold text-slate-800">
                            {formatInt(registro.dias_pendentes_total)}
                            {registro._saldo_total_colaborador > Number(registro.dias_pendentes_total || 0) ? (
                              <div className="text-[11px] font-medium text-slate-400">
                                total colaborador: {formatInt(registro._saldo_total_colaborador)}
                              </div>
                            ) : null}
                          </td>
                          <td className="px-3 py-3 text-xs text-slate-600">
                            <div>Gozo: {formatInt(registro.dias_gozo_realizados || 0)} real. / {formatInt(registro.dias_gozo_agendados || 0)} ag.</div>
                            <div>
                              Abono: {hasAbonoData(registro) ? `${formatInt(registro.dias_abono_realizados || 0)} real. / ${formatInt(registro.dias_abono_agendados || 0)} ag.` : "Nao"}
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${registro.resumo_status_chip}`}>
                              {registro.resumo_status_label}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-xs text-slate-600">
                            {getDisplayStart(registro)
                              ? `${formatDateBR(getDisplayStart(registro))} a ${formatDateBR(getDisplayEnd(registro))}`
                              : "Nao programado"}
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
                  Priorize quem venceu, quem bateu 11 meses e quem a operacao pediu para segurar.
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
                              {registro.manager_nome}
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
                    <div className="font-semibold text-slate-900">Abono no radar</div>
                    <div className="mt-1">
                      {stats.comAbono} colaborador(es) aparecem com historico ou planejamento de abono nesta base.
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <div className="font-semibold text-slate-900">Visao por gerente</div>
                    <div className="mt-1">
                      O filtro principal agora segue o gestor vinculado pelo organograma, e nao mais a area isolada.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {viewMode === "calendario" ? (
        <CalendarView
          registros={calendarRecords}
          monthKey={calendarMonth}
          onPrevMonth={goPrevMonth}
          onNextMonth={goNextMonth}
          onOpenItem={setSelecionado}
        />
      ) : null}

      {viewMode === "rh" ? (
        <RHMonthlyView groups={monthlyPlannedGroups} onOpenItem={setSelecionado} />
      ) : null}

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

function mergeFeriasData(periodos, planos, allocByKey, areasByCodigo, gestorByArea) {
  const planByFeriasId = new Map((planos || []).map((item) => [String(item.ferias_id), item]));
  return (periodos || []).map((registro) => {
    const planejamento = planByFeriasId.get(String(registro.ferias_id)) || {};
    const allocation =
      allocByKey.get(buildFuncionarioKey(registro)) ||
      allocByKey.get(buildFuncionarioKey({ funcionario_cracha: registro.nr_cracha })) ||
      allocByKey.get(buildFuncionarioKey({ nome: registro.nm_funcionario }));
    const areaCodigo = planejamento.area_codigo || allocation?.area_codigo || "";
    const areaTitulo = planejamento.area_titulo || areasByCodigo.get(areaCodigo)?.titulo || "";
    const manager = getManagerForArea(areaCodigo, areasByCodigo, gestorByArea);
    const resumo = deriveResumoStatus({
      ...registro,
      ...planejamento,
    });
    return {
      ...registro,
      ...planejamento,
      area_codigo: areaCodigo,
      area_titulo: areaTitulo,
      ...manager,
      resumo_status_key: resumo.key,
      resumo_status_label: resumo.label,
      resumo_status_chip: resumo.chip,
      resumo_status_order: resumo.order,
    };
  });
}
