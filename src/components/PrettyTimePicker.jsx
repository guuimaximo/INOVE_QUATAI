import { useEffect, useMemo, useRef, useState } from "react";
import { FaRegClock } from "react-icons/fa";

export default function PrettyTimePicker({
  value = "",
  onChange,
  startHour = 5,
  endHour = 22,
  stepMin = 15,
  placeholder = "Hora",
  className = "",
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const options = useMemo(() => {
    const arr = [];
    for (let h = startHour; h <= endHour; h++) {
      for (let m = 0; m < 60; m += stepMin) {
        arr.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
      }
    }
    return arr;
  }, [startHour, endHour, stepMin]);

  const display = (value || "").substring(0, 5);

  const pick = (v) => { onChange?.(v); setOpen(false); };

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        className="w-full flex items-center gap-2 bg-gradient-to-br from-white to-blue-50/60 border border-slate-200 hover:border-blue-300 rounded-xl pl-9 pr-3 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 relative"
      >
        <FaRegClock className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-500" size={13} />
        <span className={display ? "" : "text-slate-400 font-normal"}>
          {display || placeholder}
        </span>
      </button>

      {open && (
        <div className="absolute z-50 mt-2 left-0 w-full bg-white rounded-2xl shadow-2xl border border-slate-200 max-h-[260px] overflow-y-auto">
          {options.map((t) => (
            <button
              type="button"
              key={t}
              onClick={() => pick(t)}
              className={`w-full text-left px-4 py-2 text-sm font-semibold transition ${
                t === display
                  ? "bg-blue-600 text-white"
                  : "text-slate-700 hover:bg-blue-50 hover:text-blue-700"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
