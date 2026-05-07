import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { FaChevronRight, FaGasPump, FaPlus, FaTint } from "react-icons/fa";
import EstoqueDieselPageShell, { EstoqueDieselPanel } from "../../components/estoque-diesel/EstoqueDieselPageShell";
import {
  MONTHS_2026,
  PRODUCT_CONFIG,
  fetchDieselReceipts,
  fetchMeasurementContext,
  fetchMeasurementEntries,
  getYearFromDate,
  todayISO,
} from "./medicaoModel";

function parseLiters(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "0 L";
  return `${Number(value).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} L`;
}

function ProductSwitcher({ product }) {
  return (
    <div className="flex flex-wrap gap-2">
      {Object.values(PRODUCT_CONFIG).map((item) => {
        const active = item.code === product;
        return (
          <Link
            key={item.code}
            to={`/estoque-diesel/resumo?produto=${item.code}`}
            className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-black transition ${
              active ? "border-slate-800 bg-slate-800 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            {item.code === "S500" ? <FaTint /> : <FaGasPump />}
            {item.code}
          </Link>
        );
      })}
    </div>
  );
}

function MonthTable({ year, product, entries, receipts }) {
  const rows = MONTHS_2026.map((item) => {
    const key = `${year}-${item.month}`;
    const monthEntries = entries.filter((entry) => entry.product === product && entry.date?.startsWith(key));
    const monthReceipts = receipts.filter((receipt) => receipt.product === product && receipt.date?.startsWith(key));
    const saidaTanque = monthEntries.reduce((sum, entry) => sum + (Number(entry.saidaTanque) || 0), 0);
    const saidaTransnet = monthEntries.reduce((sum, entry) => sum + (Number(entry.saidaTransnet) || 0), 0);
    const alertas = monthEntries.filter((entry) => entry.status && entry.status !== "OK").length + monthReceipts.filter((receipt) => receipt.status && receipt.status !== "OK").length;
    return { ...item, lancamentos: monthEntries.length, recebimentos: monthReceipts.length, saidaTanque, saidaTransnet, alertas };
  });

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs font-black uppercase tracking-wider text-slate-500">
          <tr>
            {["Mês", "Lançamentos", "Recebimentos", "Saída tanque", "Transnet", "Alertas", "Ação"].map((header, index, array) => (
              <th key={header} className={`px-4 py-3 ${index === 0 ? "rounded-l-2xl" : ""} ${index === array.length - 1 ? "rounded-r-2xl" : ""}`}>
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => (
            <tr key={row.month} className="hover:bg-slate-50">
              <td className="px-4 py-3 font-black text-slate-800">{row.label}</td>
              <td className="px-4 py-3 font-semibold text-slate-600">{row.lancamentos}</td>
              <td className="px-4 py-3 font-semibold text-slate-600">{row.recebimentos}</td>
              <td className="px-4 py-3 font-semibold text-slate-600">{parseLiters(row.saidaTanque)}</td>
              <td className="px-4 py-3 font-semibold text-slate-600">{parseLiters(row.saidaTransnet)}</td>
              <td className="px-4 py-3 font-semibold text-slate-600">{row.alertas}</td>
              <td className="px-4 py-3">
                <Link
                  to={`/estoque-diesel/operacao/${year}/${row.month}?produto=${product}`}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black uppercase tracking-wider text-slate-700 transition hover:bg-slate-50"
                >
                  Abrir mês
                  <FaChevronRight />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function EstoqueDieselResumo() {
  const [searchParams] = useSearchParams();
  const productParam = searchParams.get("produto") || "S500";
  const product = productParam in PRODUCT_CONFIG ? productParam : "S500";
  const year = getYearFromDate(todayISO());

  const [entries, setEntries] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [feedback, setFeedback] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        setLoading(true);
        setFeedback(null);
        const context = await fetchMeasurementContext();
        const [nextEntries, nextReceipts] = await Promise.all([
          fetchMeasurementEntries({ year, metadata: context.metadata, paramStore: context.paramStore, includePumps: true }),
          fetchDieselReceipts({ year, metadata: context.metadata, paramStore: context.paramStore }),
        ]);
        if (!active) return;
        setEntries(nextEntries);
        setReceipts(nextReceipts);
      } catch (error) {
        console.error("Erro EstoqueDieselResumo:", error);
        if (active) setFeedback(error?.message || "Não foi possível carregar o estoque de diesel no Supabase.");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [year]);

  const totals = useMemo(() => {
    const filteredEntries = entries.filter((entry) => entry.product === product);
    const filteredReceipts = receipts.filter((receipt) => receipt.product === product);
    return {
      lancamentos: filteredEntries.length,
      recebimentos: filteredReceipts.length,
      saidaTanque: filteredEntries.reduce((sum, entry) => sum + (Number(entry.saidaTanque) || 0), 0),
      saidaTransnet: filteredEntries.reduce((sum, entry) => sum + (Number(entry.saidaTransnet) || 0), 0),
    };
  }, [entries, product, receipts]);

  return (
    <EstoqueDieselPageShell title="Estoque de Diesel" description="Tela inicial do módulo: meses em linha, produto e acesso aos lançamentos/recebimentos.">
      <EstoqueDieselPanel className="p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <Link to="/estoque-diesel" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-50">
              ← Voltar para 2026
            </Link>
            <h2 className="mt-4 text-lg font-black text-slate-800">Meses em linha</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">A parte dos meses agora fica em tabela, com botão para abrir o mês.</p>
          </div>

          <div className="flex flex-col gap-3 md:items-end">
            <ProductSwitcher product={product} />
            <Link to={`/estoque-diesel/recebimento?produto=${product}`} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-3 text-sm font-black text-white transition hover:bg-blue-600">
              <FaPlus />
              Recebimento de Diesel
            </Link>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-black uppercase text-slate-500">Lançamentos</p><p className="mt-2 text-2xl font-black text-slate-800">{totals.lancamentos}</p></div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-black uppercase text-slate-500">Recebimentos</p><p className="mt-2 text-2xl font-black text-slate-800">{totals.recebimentos}</p></div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-black uppercase text-slate-500">Saída tanque</p><p className="mt-2 text-2xl font-black text-slate-800">{parseLiters(totals.saidaTanque)}</p></div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-black uppercase text-slate-500">Transnet</p><p className="mt-2 text-2xl font-black text-slate-800">{parseLiters(totals.saidaTransnet)}</p></div>
        </div>

        {feedback ? <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{feedback}</div> : null}

        <div className="mt-5">
          {loading ? <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-sm font-bold text-slate-500">Carregando dados do Supabase...</div> : <MonthTable year={year} product={product} entries={entries} receipts={receipts} />}
        </div>
      </EstoqueDieselPanel>
    </EstoqueDieselPageShell>
  );
}
