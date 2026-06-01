import { useEffect, useMemo, useRef, useState } from "react";
import { DayPicker } from "react-day-picker";
import { ptBR } from "date-fns/locale";
import { FaRegCalendarAlt, FaTimes } from "react-icons/fa";
import "react-day-picker/style.css";

// Converte string YYYY-MM-DD em objeto Date (meio-dia BRT, evita rolar dia)
function isoToDate(iso) {
  if (!iso) return undefined;
  const [y, m, d] = String(iso).split("-").map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d, 12, 0, 0);
}

function dateToIso(date) {
  if (!date) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatPtBr(date) {
  if (!date) return "";
  return date.toLocaleDateString("pt-BR");
}

/**
 * Popover de selecao de periodo. Click no primeiro dia define inicio,
 * o segundo click define o fim. Click novo no inicio reseta a selecao.
 */
export default function DateRangePopover({
  from,
  to,
  onChange,
  onClear,
  placeholder = "Selecione o periodo",
  className = "",
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    function onClick(event) {
      if (!wrapperRef.current?.contains(event.target)) {
        setOpen(false);
      }
    }
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, [open]);

  const range = useMemo(
    () => ({ from: isoToDate(from), to: isoToDate(to) }),
    [from, to]
  );

  const label = useMemo(() => {
    if (!range.from && !range.to) return placeholder;
    if (range.from && range.to) return `${formatPtBr(range.from)} → ${formatPtBr(range.to)}`;
    if (range.from) return `A partir de ${formatPtBr(range.from)}`;
    return `Ate ${formatPtBr(range.to)}`;
  }, [range, placeholder]);

  const temFiltro = Boolean(range.from || range.to);

  function handleSelect(selected) {
    onChange?.({
      from: dateToIso(selected?.from),
      to: dateToIso(selected?.to),
    });
  }

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={`inline-flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-sm font-bold transition ${
          temFiltro
            ? "border-blue-300 bg-blue-50 text-blue-700"
            : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
        }`}
      >
        <span className="inline-flex items-center gap-2 truncate">
          <FaRegCalendarAlt className="shrink-0" />
          <span className="truncate">{label}</span>
        </span>
        {temFiltro && onClear ? (
          <span
            role="button"
            tabIndex={0}
            onClick={(event) => {
              event.stopPropagation();
              onClear();
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.stopPropagation();
                onClear();
              }
            }}
            className="rounded-full p-1 text-blue-500 transition hover:bg-blue-100"
            title="Limpar periodo"
          >
            <FaTimes />
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 z-50 mt-2 w-[20rem] rounded-2xl border border-slate-200 bg-white p-3 shadow-xl">
          <DayPicker
            mode="range"
            numberOfMonths={1}
            locale={ptBR}
            selected={range}
            onSelect={handleSelect}
            captionLayout="dropdown"
            fromYear={2024}
            toYear={2030}
            weekStartsOn={1}
            styles={{
              day: { borderRadius: "8px" },
            }}
            modifiersClassNames={{
              selected: "bg-blue-600 text-white",
              range_start: "bg-blue-600 text-white",
              range_end: "bg-blue-600 text-white",
              range_middle: "bg-blue-100 text-blue-800",
              today: "font-black underline",
            }}
          />
          <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2">
            <button
              type="button"
              onClick={() => onClear?.()}
              className="rounded-lg px-3 py-1.5 text-xs font-bold text-slate-600 transition hover:bg-slate-100"
            >
              Limpar
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-blue-700"
            >
              Aplicar
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
