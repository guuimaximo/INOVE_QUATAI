export function InovePageHeader({
  eyebrow,
  title,
  description,
  icon,
  actions = null,
  tone = "blue",
}) {
  const tones = {
    blue: "text-blue-600 bg-blue-50",
    amber: "text-amber-600 bg-amber-50",
    emerald: "text-emerald-600 bg-emerald-50",
    slate: "text-slate-700 bg-slate-100",
  };
  const toneClass = tones[tone] || tones.blue;

  return (
    <div className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:flex-row md:items-end md:justify-between">
      <div>
        <div className={`text-xs font-black uppercase tracking-[0.24em] ${toneClass.split(" ")[0]}`}>
          {eyebrow}
        </div>
        <h1 className="mt-3 flex items-center gap-3 text-3xl font-black text-slate-900">
          {icon ? <span className={`rounded-2xl p-3 shadow-sm ${toneClass}`}>{icon}</span> : null}
          {title}
        </h1>
        {description ? <p className="mt-2 max-w-4xl text-sm text-slate-600">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function InoveSection({ title, icon = null, children, className = "" }) {
  return (
    <section className={`rounded-3xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
      {title ? (
        <h2 className="mb-4 flex items-center gap-2 text-lg font-black text-slate-900">
          {icon}
          {title}
        </h2>
      ) : null}
      {children}
    </section>
  );
}

export function InoveStatCard({ title, value, icon = null, tone = "blue" }) {
  const tones = {
    blue: "from-blue-50 to-cyan-50 border-blue-200 text-blue-700",
    indigo: "from-indigo-50 to-blue-50 border-indigo-200 text-indigo-700",
    emerald: "from-emerald-50 to-teal-50 border-emerald-200 text-emerald-700",
    amber: "from-amber-50 to-yellow-50 border-amber-200 text-amber-700",
    rose: "from-rose-50 to-pink-50 border-rose-200 text-rose-700",
    slate: "from-slate-50 to-gray-50 border-slate-200 text-slate-700",
  };

  return (
    <div className={`min-h-[124px] rounded-3xl border bg-gradient-to-br p-4 shadow-sm ${tones[tone] || tones.blue}`}>
      <div className="flex h-full items-start justify-between gap-3">
        <div className="flex h-full min-w-0 flex-col justify-between">
          <p className="text-xs font-black uppercase tracking-[0.18em] opacity-80">{title}</p>
          <p className="mt-3 text-3xl font-black text-slate-900">{value}</p>
        </div>
        {icon ? <div className="text-4xl opacity-80">{icon}</div> : null}
      </div>
    </div>
  );
}

export const inoveInputClass =
  "w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold outline-none transition focus:border-blue-400 focus:bg-white";

export const inoveButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-black text-white shadow-sm transition hover:bg-blue-700 disabled:bg-slate-400";
