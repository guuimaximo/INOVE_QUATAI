import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FaCalendarAlt, FaChevronRight, FaExclamationTriangle, FaGasPump, FaTint } from "react-icons/fa";
import EstoqueDieselPageShell, {
  EstoqueDieselPanel,
  EstoqueDieselStat,
} from "../../components/estoque-diesel/EstoqueDieselPageShell";
import {
  MONTHS_2026,
  fetchMeasurementContext,
  fetchMeasurementEntries,
  getMonthLabel,
} from "./medicaoModel";

function MonthRow({ month, entries, isCurrentMonth }) {
  const s500Count = entries.filter((entry) => entry.product === "S500").length;
  const s10Count = entries.filter((entry) => entry.product === "S10").length;
  const criticalCount = entries.filter((entry) => entry.status === "Critico").length;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-slate-500">
              <FaCalendarAlt />
              2026
            </span>
            {isCurrentMonth ? (
              <span className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-blue-700">
                Mes atual
              </span>
            ) : null}
          </div>
          <h2 className="mt-3 text-xl font-black text-slate-800">{getMonthLabel(month)}</h2>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            Abra o mes para lancar a medicao diaria e conferir a tabela de S500 e S10.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3 lg:min-w-[360px]">
          <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
            <p className="text-xs font-black uppercase tracking-wider text-blue-700">S500</p>
            <p className="mt-1 text-lg font-black text-slate-800">{s500Count}</p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
            <p className="text-xs font-black uppercase tracking-wider text-emerald-700">S10</p>
            <p className="mt-1 text-lg font-black text-slate-800">{s10Count}</p>
          </div>
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
            <p className="text-xs font-black uppercase tracking-wider text-rose-700">Alertas</p>
            <p className="mt-1 text-lg font-black text-slate-800">{criticalCount}</p>
          </div>
        </div>

        <div className="lg:min-w-[160px]">
          <Link
            to={`/estoque-diesel/operacao/2026/${month}`}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-800 px-4 py-3 text-sm font-black text-white transition hover:bg-slate-700"
          >
            Abrir mes
            <FaChevronRight />
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function EstoqueDieselResumo() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let active = true;

    async function loadData() {
      try {
        setLoading(true);
        setErrorMessage("");
        const { metadata, paramStore } = await fetchMeasurementContext();
        const nextEntries = await fetchMeasurementEntries({
          year: "2026",
          metadata,
          paramStore,
          includePumps: false,
        });
        if (!active) return;
        setEntries(nextEntries);
      } catch (error) {
        if (!active) return;
        console.error("Falha ao carregar medicoes de diesel:", error);
        setErrorMessage("Nao foi possivel carregar as medicoes do Supabase.");
      } finally {
        if (active) setLoading(false);
      }
    }

    loadData();
    return () => {
      active = false;
    };
  }, []);

  const stats = useMemo(() => {
    const entries2026 = entries.filter((entry) => entry.date?.startsWith("2026-"));
    return {
      total: entries2026.length,
      s500: entries2026.filter((entry) => entry.product === "S500").length,
      s10: entries2026.filter((entry) => entry.product === "S10").length,
      critical: entries2026.filter((entry) => entry.status === "Critico").length,
    };
  }, [entries]);

  const currentMonth = new Date().toISOString().slice(5, 7);

  return (
    <EstoqueDieselPageShell
      title="Medicao de Diesel"
      description="Controle mensal de 2026 com abertura por mes e lancamento diario no formato da operacao."
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <EstoqueDieselStat title="2026" value="12 meses" sub="Calendario operacional" icon={<FaCalendarAlt />} tone="blue" />
        <EstoqueDieselStat title="Lancamentos" value={String(stats.total)} sub="Dias salvos no Supabase" icon={<FaTint />} tone="slate" />
        <EstoqueDieselStat title="S500 / S10" value={`${stats.s500} / ${stats.s10}`} sub="Separados por produto" icon={<FaGasPump />} tone="emerald" />
        <EstoqueDieselStat title="Criticos" value={String(stats.critical)} sub="Dias acima do limite" icon={<FaExclamationTriangle />} tone="rose" />
      </div>

      <EstoqueDieselPanel className="p-5">
        <h2 className="text-lg font-black text-slate-800">Fluxo da medicao</h2>
        <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-4">
          {[
            "1. Abrir o mes na linha abaixo",
            "2. Lancar o dia com medicao atual",
            "3. Conferir recebimento, bombas e Transnet",
            "4. Validar a tabela do mes na mesma pagina",
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

      {errorMessage ? (
        <EstoqueDieselPanel className="border-rose-200 bg-rose-50 p-5">
          <p className="text-sm font-semibold text-rose-700">{errorMessage}</p>
        </EstoqueDieselPanel>
      ) : null}

      <div className="space-y-4">
        {MONTHS_2026.map((item) => {
          const monthEntries = entries.filter((entry) => entry.date?.startsWith(`2026-${item.month}`));
          return (
            <MonthRow
              key={item.month}
              month={item.month}
              entries={monthEntries}
              isCurrentMonth={item.month === currentMonth}
            />
          );
        })}
      </div>

      {loading ? (
        <EstoqueDieselPanel className="p-5">
          <p className="text-sm font-semibold text-slate-500">Carregando medicoes de 2026...</p>
        </EstoqueDieselPanel>
      ) : null}
    </EstoqueDieselPageShell>
  );
}
