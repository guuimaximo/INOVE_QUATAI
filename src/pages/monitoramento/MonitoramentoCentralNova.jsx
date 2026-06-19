import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaCalendarAlt, FaCar, FaChartBar, FaChevronLeft, FaChevronRight, FaMagic } from "react-icons/fa";
import { supabase } from "../../supabase";

const STATE_KEY = "inove.monitoramento.state.v4";
const MONTHS = [
  "Janeiro",
  "Fevereiro",
  "Marco",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];
const WEEKDAYS = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SAB"];

function readPersistedState() {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(STATE_KEY) || "{}") || {};
  } catch {
    return {};
  }
}

function writePersistedState(next) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STATE_KEY, JSON.stringify(next));
  } catch {}
}

function toIsoDate(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (!value || Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function startOfMonthIso(isoDate) {
  const d = isoDate ? new Date(`${isoDate}T00:00:00`) : new Date();
  if (Number.isNaN(d.getTime())) return toIsoDate(new Date());
  return toIsoDate(new Date(d.getFullYear(), d.getMonth(), 1));
}

function shiftMonthIso(isoMonth, delta) {
  const d = isoMonth ? new Date(`${isoMonth}T00:00:00`) : new Date();
  if (Number.isNaN(d.getTime())) return startOfMonthIso(toIsoDate(new Date()));
  return toIsoDate(new Date(d.getFullYear(), d.getMonth() + delta, 1));
}

function formatMonthLabel(isoMonth) {
  const d = new Date(`${isoMonth || ""}T00:00:00`);
  return Number.isNaN(d.getTime()) ? "-" : `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function buildMonthGrid(isoMonth) {
  const base = new Date(`${isoMonth}T00:00:00`);
  if (Number.isNaN(base.getTime())) return [];

  const year = base.getFullYear();
  const month = base.getMonth();
  const firstWeekDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];

  for (let i = 0; i < firstWeekDay; i += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) cells.push(toIsoDate(new Date(year, month, day)));
  while (cells.length % 7 !== 0) cells.push(null);

  return cells;
}

function getCalendarTone(item, active = false) {
  if (active) {
    return {
      cell: "border-blue-300 bg-blue-50 text-blue-700 shadow-sm",
      label: "Selecionado",
    };
  }

  if (!item || !item.total_laudos) {
    return {
      cell: "border-rose-200 bg-rose-50/70 text-rose-700",
      label: "Sem laudo",
    };
  }

  if (item.inspecionado) {
    return {
      cell: "border-emerald-200 bg-emerald-50/80 text-emerald-700",
      label: "Fechado",
    };
  }

  return {
    cell: "border-amber-200 bg-amber-50/80 text-amber-700",
    label: "Laudo pendente",
  };
}

function HeaderTab({ active, icon, label }) {
  return (
    <button
      type="button"
      className={`flex min-h-[68px] items-center justify-center gap-3 px-4 py-4 text-sm font-bold transition md:px-6 ${
        active ? "bg-white text-blue-600 shadow-[inset_0_-4px_0_0_#1d4ed8]" : "bg-white text-slate-500 hover:bg-slate-50"
      }`}
    >
      <span className={`text-lg ${active ? "text-blue-600" : "text-slate-400"}`}>{icon}</span>
      <span>{label}</span>
    </button>
  );
}

export default function MonitoramentoCentral() {
  const navigate = useNavigate();
  const persistedState = useMemo(() => readPersistedState(), []);
  const [calendarMonth, setCalendarMonth] = useState(() =>
    startOfMonthIso(persistedState.calendarMonth || persistedState.selectedDay || toIsoDate(new Date()))
  );
  const [selectedDay, setSelectedDay] = useState(() => persistedState.selectedDay || "");
  const [calendarDays, setCalendarDays] = useState([]);
  const [loadingCalendar, setLoadingCalendar] = useState(false);
  const reloadTimerRef = useRef(null);

  const calendarMap = useMemo(() => new Map(calendarDays.map((item) => [item.dt_evento, item])), [calendarDays]);
  const calendarGrid = useMemo(() => buildMonthGrid(calendarMonth), [calendarMonth]);

  const fetchCalendarData = useCallback(async (monthIso, options = {}) => {
    const { background = false } = options;
    if (!monthIso) {
      setCalendarDays([]);
      if (!background) setLoadingCalendar(false);
      return;
    }

    const monthDate = new Date(`${monthIso}T00:00:00`);
    const end = toIsoDate(new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0));

    if (!background) setLoadingCalendar(true);
    try {
      const { data, error } = await supabase
        .from("vw_monitoramento_inspecoes_calendario")
        .select("dt_evento,total_laudos,inspecionado")
        .gte("dt_evento", monthIso)
        .lte("dt_evento", end)
        .order("dt_evento", { ascending: true });

      if (error) {
        console.error("Erro ao carregar calendario:", error);
        setCalendarDays([]);
        return;
      }

      setCalendarDays(Array.isArray(data) ? data : []);
    } finally {
      if (!background) setLoadingCalendar(false);
    }
  }, []);

  useEffect(() => {
    writePersistedState({
      calendarMonth,
      selectedDay,
    });
  }, [calendarMonth, selectedDay]);

  useEffect(() => {
    fetchCalendarData(calendarMonth);
  }, [calendarMonth, fetchCalendarData]);

  useEffect(() => {
    const scheduleReload = () => {
      if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current);
      reloadTimerRef.current = setTimeout(() => {
        fetchCalendarData(calendarMonth, { background: true });
      }, 500);
    };

    const channel = supabase
      .channel("vision-monitoramento-calendario")
      .on("postgres_changes", { event: "*", schema: "public", table: "monitoramento_dias" }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "vision_inspecoes" }, scheduleReload)
      .subscribe();

    return () => {
      if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current);
      supabase.removeChannel(channel);
    };
  }, [fetchCalendarData, calendarMonth]);

  const selecionarDia = (day) => {
    if (!day) return;
    setSelectedDay(day);
    setCalendarMonth(startOfMonthIso(day));
    navigate(`/monitoramento/dia/${day}`);
  };

  const topTabs = [
    { id: "dashboard", label: "Dashboard", icon: <FaChartBar /> },
    { id: "veiculos", label: "Veículos", icon: <FaCar /> },
    { id: "prompt", label: "Prompt GEMINI", icon: <FaMagic /> },
  ];

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="mx-auto flex max-w-[1500px] flex-col gap-5">
        <header className="rounded-[28px] border border-slate-200 bg-white px-6 py-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-sm">
                <FaCalendarAlt className="text-lg" />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.24em] text-blue-600">VISION WEB</p>
                <h1 className="mt-2 text-[28px] font-black tracking-tight text-slate-900 md:text-[34px]">
                  Monitoramento de Inspeções
                </h1>
              </div>
            </div>

            <div className="grid overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:min-w-[640px] lg:grid-cols-3">
              {topTabs.map((tab, index) => (
                <div key={tab.id} className={`${index > 0 ? "border-l border-slate-200" : ""}`}>
                  <HeaderTab active={index === 0} icon={tab.icon} label={tab.label} />
                </div>
              ))}
            </div>
          </div>
        </header>

        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_18px_60px_rgba(15,23,42,0.08)] md:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 shadow-sm">
                <FaCalendarAlt className="text-xl" />
              </div>
              <div>
                <h2 className="text-2xl font-black tracking-tight text-slate-900 md:text-[28px]">
                  Calendário de Monitoramento
                </h2>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setCalendarMonth(shiftMonthIso(calendarMonth, -1))}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                <FaChevronLeft className="text-xs" />
                Mês anterior
              </button>
              <button
                type="button"
                onClick={() => setCalendarMonth(startOfMonthIso(toIsoDate(new Date())))}
                className="inline-flex items-center rounded-full border border-slate-200 bg-white px-6 py-3 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                Hoje
              </button>
              <button
                type="button"
                onClick={() => setCalendarMonth(shiftMonthIso(calendarMonth, 1))}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                Próximo mês
                <FaChevronRight className="text-xs" />
              </button>
            </div>
          </div>

          <div className="mt-6 border-t border-slate-200 pt-8">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <h3 className="text-[28px] font-black tracking-tight text-slate-900 md:text-[31px]">
                {formatMonthLabel(calendarMonth)}
              </h3>
            </div>

            <div className="mt-6 grid grid-cols-7 gap-3 text-center text-[12px] font-black uppercase tracking-[0.16em] text-slate-400">
              {WEEKDAYS.map((label) => (
                <span key={label}>{label}</span>
              ))}
            </div>

            <div className="mt-5 grid grid-cols-7 gap-3">
              {calendarGrid.map((day, index) => {
                if (!day) {
                  return (
                    <div
                      key={`blank-${index}`}
                      className="min-h-[96px] rounded-2xl border border-dashed border-slate-200 bg-slate-50/40"
                    />
                  );
                }

                const item = calendarMap.get(day);
                const active = selectedDay === day;
                const tone = getCalendarTone(item, active);
                const hasData = Boolean(item?.total_laudos);

                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => selecionarDia(day)}
                    className={`min-h-[96px] rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md ${tone.cell}`}
                  >
                    <div className="flex h-full flex-col justify-between">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-lg font-black leading-none">{day.slice(8, 10)}</p>
                        </div>
                      </div>
                      <div>
                        <p className={`text-sm font-bold ${hasData ? "" : "text-rose-600"}`}>
                          {item?.total_laudos ? `${item.total_laudos} laudo(s)` : "Sem laudo"}
                        </p>
                        {active ? <p className="mt-1 text-[11px] font-black uppercase tracking-[0.16em]">Selecionado</p> : null}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
