import { Link } from "react-router-dom";
import { FaCar, FaChartBar, FaClipboard, FaMagic } from "react-icons/fa";

const TAB_CLASS =
  "flex min-h-[56px] items-center justify-center gap-2 px-3 py-3 text-[13px] font-bold transition";

export function MonitoramentoTabs({ active = "laudos" }) {
  const tabs = [
    { key: "dashboard", label: "Dashboard", icon: <FaChartBar />, to: "/monitoramento/dashboard" },
    { key: "laudos", label: "Laudos", icon: <FaClipboard />, to: "/monitoramento" },
    { key: "veiculos", label: "Veículos", icon: <FaCar />, to: "/monitoramento/veiculos" },
    { key: "prompt", label: "Prompt GEMINI", icon: <FaMagic />, to: "/monitoramento/prompt-gemini" },
  ];

  return (
    <div className="grid overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:grid-cols-4">
      {tabs.map((tab, index) => {
        const isActive = tab.key === active;

        return (
          <div key={tab.key} className={`${index > 0 ? "border-l border-slate-200" : ""}`}>
            <Link
              to={tab.to}
              className={`${TAB_CLASS} ${isActive ? "bg-slate-50 text-blue-600 shadow-[inset_0_-3px_0_0_#2563eb]" : "bg-white text-slate-500 hover:bg-slate-50"}`}
            >
              <span className={`text-base ${isActive ? "text-blue-600" : "text-slate-400"}`}>{tab.icon}</span>
              <span>{tab.label}</span>
            </Link>
          </div>
        );
      })}
    </div>
  );
}

export function MonitoramentoFrame({ eyebrow = "VISION WEB", title, icon, children, actions = null, activeTab = "laudos", description = "" }) {
  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="mx-auto flex max-w-[1500px] flex-col gap-4">
        <header className="rounded-[24px] border border-slate-200 bg-white px-5 py-4 shadow-[0_12px_40px_rgba(15,23,42,0.06)] md:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              {icon ? (
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-sm">
                  {icon}
                </div>
              ) : null}
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.24em] text-blue-600">{eyebrow}</p>
                <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-900 md:text-[30px]">{title}</h1>
                {description ? <p className="mt-1 max-w-3xl text-sm text-slate-500">{description}</p> : null}
              </div>
            </div>

            {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
          </div>

          <div className="mt-4">
            <MonitoramentoTabs active={activeTab} />
          </div>
        </header>

        {children}
      </div>
    </div>
  );
}

export function MonitoramentoSection({ title, subtitle = "", actions = null, children, className = "" }) {
  return (
    <section className={`rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_12px_40px_rgba(15,23,42,0.06)] md:p-5 ${className}`}>
      {(title || subtitle || actions) && (
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            {title ? <h2 className="text-xl font-black tracking-tight text-slate-900">{title}</h2> : null}
            {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      )}
      {children}
    </section>
  );
}

export function MonitoramentoStatCard({ title, value, tone = "blue", helper = "" }) {
  const tones = {
    blue: "border-blue-200 bg-blue-50/80 text-blue-700",
    emerald: "border-emerald-200 bg-emerald-50/80 text-emerald-700",
    amber: "border-amber-200 bg-amber-50/80 text-amber-700",
    rose: "border-rose-200 bg-rose-50/80 text-rose-700",
    slate: "border-slate-200 bg-slate-50 text-slate-700",
  };

  return (
    <div className={`rounded-[18px] border p-3 shadow-sm ${tones[tone] || tones.blue}`}>
      <p className="text-[10px] font-black uppercase tracking-[0.18em] opacity-80">{title}</p>
      <p className="mt-2 text-2xl font-black leading-none text-slate-900">{value}</p>
      {helper ? <p className="mt-2 text-[11px] font-semibold text-slate-500">{helper}</p> : null}
    </div>
  );
}
