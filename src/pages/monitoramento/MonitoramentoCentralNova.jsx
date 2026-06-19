import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaCalendarAlt, FaChevronLeft, FaChevronRight } from "react-icons/fa";
import { supabase } from "../../supabase";
import { MonitoramentoFrame, MonitoramentoSection } from "./MonitoramentoShell";

const STATE_KEY = "inove.monitoramento.state.v5";
const MONTHS = ["Janeiro", "Fevereiro", "Marco", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
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

  return (
    <MonitoramentoFrame
      title="Monitoramento de Inspeções"
      icon={<FaCalendarAlt className="text-lg" />}
      activeTab="laudos"
      description="Escolha o dia no calendário para abrir os laudos daquele período. As cores indicam a situação de cada dia."
      actions={
        <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600">
          <span className={`h-2.5 w-2.5 rounded-full ${loadingCalendar ? "bg-amber-400" : "bg-emerald-500"}`} />
          {loadingCalendar ? "Atualizando calendário" : "Calendário pronto"}
        </div>
      }
    >
      <MonitoramentoSection
        title="Calendário de Monitoramento"
        subtitle="Dias em vermelho sem laudo, amarelo com laudo aberto e verde já inspecionado e fechado"
        actions={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setCalendarMonth(shiftMonthIso(calendarMonth, -1))}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <FaChevronLeft className="text-xs" />
              Mês anterior
            </button>
            <button
              type="button"
              onClick={() => setCalendarMonth(startOfMonthIso(toIsoDate(new Date())))}
              className="inline-flex items-center rounded-full border border-slate-200 bg-white px-5 py-2 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              Hoje
            </button>
            <button
              type="button"
              onClick={() => setCalendarMonth(shiftMonthIso(calendarMonth, 1))}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              Próximo mês
              <FaChevronRight className="text-xs" />
            </button>
          </div>
        }
      >
        <div className="border-t border-slate-200 pt-5">
          <h3 className="text-2xl font-black tracking-tight text-slate-900">{formatMonthLabel(calendarMonth)}</h3>

          <div className="mt-4 grid grid-cols-7 gap-2 text-center text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">
            {WEEKDAYS.map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>

          <div className="mt-3 grid grid-cols-7 gap-2">
            {calendarGrid.map((day, index) => {
              if (!day) {
                return <div key={`blank-${index}`} className="min-h-[80px] rounded-2xl border border-dashed border-slate-200 bg-slate-50/40" />;
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
                  className={`min-h-[80px] rounded-2xl border p-3 text-left transition hover:-translate-y-0.5 hover:shadow-md ${tone.cell}`}
                >
                  <div className="flex h-full flex-col justify-between">
                    <p className="text-base font-black leading-none">{day.slice(8, 10)}</p>
                    <div>
                      <p className={`text-[13px] font-bold ${hasData ? "" : "text-rose-600"}`}>
                        {item?.total_laudos ? `${item.total_laudos} laudo(s)` : "Sem laudo"}
                      </p>
                      {active ? <p className="mt-1 text-[10px] font-black uppercase tracking-[0.16em]">{tone.label}</p> : null}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </MonitoramentoSection>
    </MonitoramentoFrame>
  );
}
