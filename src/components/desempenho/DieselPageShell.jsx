export function DieselPageShell({
  badge,
  title,
  description,
  actions = null,
  children,
  className = "",
}) {
  return (
    <div className={`min-h-screen bg-slate-50 p-4 space-y-5 ${className}`.trim()}>
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 md:p-5">
        <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4">
          <div>
            {badge ? (
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-black border border-blue-200">
                {badge}
              </div>
            ) : null}
            <h1 className="mt-3 text-2xl md:text-3xl font-black text-slate-800">{title}</h1>
            {description ? (
              <p className="text-sm text-slate-500 mt-1 font-semibold">{description}</p>
            ) : null}
          </div>

          {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
        </div>
      </div>

      {children}
    </div>
  );
}

export function DieselPanel({ children, className = "" }) {
  return (
    <div className={`bg-white rounded-2xl border border-slate-200 shadow-sm ${className}`.trim()}>
      {children}
    </div>
  );
}

export function DieselStatCard({ title, value, sub, icon, tone = "slate" }) {
  const tones = {
    slate: "from-slate-50 to-gray-50 border-slate-200 text-slate-700",
    blue: "from-blue-50 to-cyan-50 border-blue-200 text-blue-700",
    emerald: "from-emerald-50 to-teal-50 border-emerald-200 text-emerald-700",
    amber: "from-amber-50 to-orange-50 border-amber-200 text-amber-700",
    rose: "from-rose-50 to-pink-50 border-rose-200 text-rose-700",
    violet: "from-violet-50 to-fuchsia-50 border-violet-200 text-violet-700",
  };

  return (
    <div
      className={`rounded-2xl border bg-gradient-to-br p-4 shadow-sm ${tones[tone] || tones.slate}`}
    >
      <div className="flex items-start justify-between gap-3 h-full">
        <div>
          <p className="text-xs font-black uppercase tracking-wider opacity-80">{title}</p>
          <p className="text-2xl font-black mt-2 text-slate-800">{value}</p>
          {sub ? <p className="text-[11px] mt-1 font-bold opacity-80">{sub}</p> : null}
        </div>
        {icon ? (
          <div className="h-11 w-11 rounded-xl bg-white/70 border border-white/80 flex items-center justify-center text-lg">
            {icon}
          </div>
        ) : null}
      </div>
    </div>
  );
}
