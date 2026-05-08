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

const TANK_CAPACITY_LITERS = 30000;

function formatLiters(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return "0 L";
  return `${Number(value).toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })} L`;
}

function TankColumn({ label, liters, tone = "blue" }) {
  const safeLiters = Math.max(0, Number(liters || 0));
  const percentage = Math.max(0, Math.min(100, (safeLiters / TANK_CAPACITY_LITERS) * 100));
  const gradients = {
    blue: "from-blue-500 via-cyan-500 to-sky-300",
    emerald: "from-emerald-500 via-teal-500 to-cyan-300",
  };

  return (
    <div className="flex min-w-[150px] flex-1 flex-col rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-wider text-slate-500">{label}</p>
          <p className="mt-1 text-xl font-black text-slate-800">{formatLiters(safeLiters)}</p>
        </div>
        <div className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-black uppercase tracking-wider text-slate-500">
          {percentage.toFixed(1)}%
        </div>
      </div>

      <div className="mt-4 flex justify-center">
        <div className="relative flex h-56 w-24 items-end overflow-hidden rounded-[28px] border-4 border-slate-300 bg-white shadow-inner">
          <div
            className={`absolute inset-x-0 bottom-0 rounded-b-[20px] bg-gradient-to-t ${gradients[tone]} transition-all duration-700 ease-out`}
            style={{ height: `${percentage}%` }}
          >
            <div className="absolute inset-x-2 top-3 h-4 rounded-full bg-white/30 blur-sm" />
          </div>
          <div className="relative z-10 flex w-full items-start justify-center pt-5 text-[11px] font-black uppercase tracking-wider text-slate-500">
            30.000 L
          </div>
        </div>
      </div>
    </div>
  );
}

function TankProductSummary({ product, entry }) {
  const tankColumns =
    product === "S500"
      ? [{ label: "T2", liters: entry?.litrosFinalT2 || 0, tone: "emerald" }]
      : [{ label: "T1", liters: entry?.litrosFinalT1 || 0, tone: "blue" }];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-slate-500">
            {product}
          </div>
          <h2 className="mt-3 text-xl font-black text-slate-800">Resumo visual dos tanques</h2>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            {product === "S500"
              ? "Volume atual do lado T2. O acompanhamento visual usa capacidade de 30.000 L."
              : "Volume atual do lado T1. O acompanhamento visual usa capacidade de 30.000 L."}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black uppercase tracking-wider text-slate-500">
          {entry?.date
            ? `Base ${new Date(`${entry.date}T00:00:00`).toLocaleDateString("pt-BR")}`
            : "Sem leitura carregada"}
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-4 lg:flex-row">
        {tankColumns.map((tank) => (
          <TankColumn key={tank.label} label={tank.label} liters={tank.liters} tone={tank.tone} />
        ))}
      </div>
    </div>
  );
}

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
  const latestEntriesByProduct = useMemo(() => {
    return ["S500", "S10"].reduce((acc, product) => {
      acc[product] =
        [...entries]
          .filter((entry) => entry.product === product)
          .sort((a, b) => new Date(`${b.date}T00:00:00`) - new Date(`${a.date}T00:00:00`))[0] || null;
      return acc;
    }, {});
  }, [entries]);

  return (
    <EstoqueDieselPageShell
      title="Medicao de Diesel"
      description="Controle mensal de 2026 com abertura por mes e lancamento diario no formato da operacao."
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <EstoqueDieselStat title="2026" value="12 meses" sub="Calendario operacional" icon={<FaCalendarAlt />} tone="blue" />
        <EstoqueDieselStat title="Lancamentos" value={String(stats.total)} sub="Dias salvos no Supabase" icon={<FaTint />} tone="slate" />
        <EstoqueDieselStat title="S500 / S10" value={`${stats.s500} / ${stats.s10}`} sub="Separados por produto" icon={<FaGasPump />} tone="emerald" />
        <EstoqueDieselStat title="Dias criticos" value={String(stats.critical)} sub="NF ou Transnet acima do limite critico" icon={<FaExclamationTriangle />} tone="rose" />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <TankProductSummary product="S500" entry={latestEntriesByProduct.S500} />
        <TankProductSummary product="S10" entry={latestEntriesByProduct.S10} />
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
