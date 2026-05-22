import { NavLink } from "react-router-dom";
import { FaExchangeAlt, FaFileInvoice, FaListAlt, FaTools } from "react-icons/fa";

const TABS = [
  { path: "/embarcados-central", label: "Central", icon: <FaListAlt /> },
  { path: "/embarcados-movimentacoes", label: "Movimentacoes", icon: <FaExchangeAlt /> },
  { path: "/embarcados-reparos", label: "Reparos", icon: <FaTools /> },
  { path: "/embarcados-envio-manutencao", label: "Envio Manutencao", icon: <FaFileInvoice /> },
];

export default function EmbarcadosModuleTabs() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {TABS.map((tab) => (
          <NavLink
            key={tab.path}
            to={tab.path}
            className={({ isActive }) =>
              `inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-black transition md:text-sm ${
                isActive
                  ? "bg-slate-900 text-white shadow-sm"
                  : "bg-slate-50 text-slate-700 hover:bg-slate-100"
              }`
            }
          >
            {tab.icon}
            <span className="truncate">{tab.label}</span>
          </NavLink>
        ))}
      </div>
    </div>
  );
}
