import { useMemo } from "react";
import { Link } from "react-router-dom";
import { FaCalendarAlt, FaGasPump, FaTint } from "react-icons/fa";
import EstoqueDieselPageShell, {
  EstoqueDieselPanel,
  EstoqueDieselStat,
} from "../../components/estoque-diesel/EstoqueDieselPageShell";
import { MONTHS_2026, getMonthLabel, loadEntries } from "./medicaoModel";

function MonthCard({ month, entries }) {
  const s500Count = entries.filter((entry) => entry.product === "S500").length;
  const s10Count = entries.filter((entry) => entry.product === "S10").length;
  const criticalCount = entries.filter((entry) => entry.status === "Critico").length;

  return (
    <EstoqueDieselPanel className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-slate-500">
            <FaCalendarAlt />
            2026
          </div>
          <h2 className="mt-3 text-xl font-black text-slate-800">{getMonthLabel(month)}</h2>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            Entrar no mes para lancar e acompanhar S500 e S10.
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-center">
          <p className="text-xs font-black uppercase tracking-wider text-slate-500">Alertas</p>
          <p className="mt-1 text-2xl font-black text-slate-800">{criticalCount}</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
          <p className="text-xs font-black uppercase tracking-wider text-blue-700">S500</p>
          <p className="mt-1 text-lg font-black text-slate-800">{s500Count} lancamentos</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <p className="text-xs font-black uppercase tracking-wider text-emerald-700">S10</p>
          <p className="mt-1 text-lg font-black text-slate-800">{s10Count} lancamentos</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Link
          to={`/estoque-diesel/operacao/2026/${month}?produto=S500`}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-800 px-4 py-3 text-sm font-black text-white transition hover:bg-slate-700"
        >
          <FaTint />
          Abrir S500
        </Link>
        <Link
          to={`/estoque-diesel/operacao/2026/${month}?produto=S10`}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50"
        >
          <FaGasPump />
          Abrir S10
        </Link>
      </div>
    </EstoqueDieselPanel>
  );
}

export default function EstoqueDieselResumo() {
  const entries = loadEntries();

  const stats = useMemo(() => {
    const entries2026 = entries.filter((entry) => entry.date?.startsWith("2026-"));
    return {
      total: entries2026.length,
      s500: entries2026.filter((entry) => entry.product === "S500").length,
      s10: entries2026.filter((entry) => entry.product === "S10").length,
      critical: entries2026.filter((entry) => entry.status === "Critico").length,
    };
  }, [entries]);

  return (
    <EstoqueDieselPageShell
      title="Medicao de Diesel"
      description="Entrada profissional por mes para 2026, com lancamento diario no formato da planilha de medicao de combustivel."
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <EstoqueDieselStat title="2026" value="12 meses" sub="Calendario pronto no Inove" icon={<FaCalendarAlt />} tone="blue" />
        <EstoqueDieselStat title="Lancamentos" value={String(stats.total)} sub="Registros salvos em 2026" icon={<FaTint />} tone="slate" />
        <EstoqueDieselStat title="S500 / S10" value={`${stats.s500} / ${stats.s10}`} sub="Separados por produto" icon={<FaGasPump />} tone="emerald" />
        <EstoqueDieselStat title="Criticos" value={String(stats.critical)} sub="Dias acima do limite" icon={<FaTint />} tone="rose" />
      </div>

      <EstoqueDieselPanel className="p-5">
        <h2 className="text-lg font-black text-slate-800">Como vamos trabalhar este modulo</h2>
        <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-4">
          {[
            "1. Escolher o mes de 2026",
            "2. Abrir S500 ou S10",
            "3. Lancar a medicao com calculos automaticos",
            "4. Conferir a tabela do mes na mesma tela",
          ].map((item) => (
            <div
              key={item}
              className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600"
            >
              {item}
            </div>
          ))}
        </div>
      </EstoqueDieselPanel>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {MONTHS_2026.map((item) => (
          <MonthCard
            key={item.month}
            month={item.month}
            entries={entries.filter((entry) => entry.date?.startsWith(`2026-${item.month}`))}
          />
        ))}
      </div>
    </EstoqueDieselPageShell>
  );
}
