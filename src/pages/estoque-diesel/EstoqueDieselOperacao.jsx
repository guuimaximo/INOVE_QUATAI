import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { FaArrowLeft, FaCheckCircle, FaExclamationTriangle, FaGasPump, FaInfoCircle, FaPlus, FaSave, FaTint } from "react-icons/fa";
import EstoqueDieselPageShell, { EstoqueDieselPanel } from "../../components/estoque-diesel/EstoqueDieselPageShell";
import {
  DEFAULT_PARAMS,
  PRODUCT_CONFIG,
  buildDefaultForm,
  computeMeasurement,
  fetchDieselReceipts,
  fetchMeasurementContext,
  fetchMeasurementEntries,
  getDailyReceipts,
  getMonthLabel,
  getPreviousEntry,
  measurementStatus,
  saveMeasurementEntry,
  todayISO,
  validateMeasurement,
} from "./medicaoModel";
import { useAuth } from "../../context/AuthContext";

function parsePct(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "--";
  return `${(Number(value) * 100).toFixed(2)}%`;
}

function parseLiters(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "0 L";
  return `${Number(value).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} L`;
}

function formatDate(date) {
  if (!date) return "--";
  return new Date(`${date}T00:00:00`).toLocaleDateString("pt-BR");
}

function FormInput({ label, value, onChange, type = "number", step = "0.1", required = false, disabled = false }) {
  return (
    <label className="block">
      <span className="text-xs font-black uppercase tracking-wider text-slate-500">{label}{required ? " *" : ""}</span>
      <input
        type={type}
        value={value ?? ""}
        step={type === "number" ? step : undefined}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className={`mt-2 w-full rounded-xl border px-4 py-3 text-sm font-semibold outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 ${disabled ? "border-slate-200 bg-slate-100 text-slate-500" : "border-slate-200 bg-white text-slate-700"}`}
      />
    </label>
  );
}

function SummaryCard({ title, value, tone = "slate" }) {
  const tones = {
    slate: "border-slate-200 bg-slate-50 text-slate-700",
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    rose: "border-rose-200 bg-rose-50 text-rose-700",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
  };
  return <div className={`rounded-2xl border p-4 ${tones[tone]}`}><p className="text-xs font-black uppercase tracking-wider opacity-80">{title}</p><p className="mt-2 text-2xl font-black text-slate-800">{value}</p></div>;
}

function ProductSwitcher({ product, year, month }) {
  return (
    <div className="flex flex-wrap gap-2">
      {Object.values(PRODUCT_CONFIG).map((item) => {
        const active = item.code === product;
        return (
          <Link key={item.code} to={`/estoque-diesel/operacao/${year}/${month}?produto=${item.code}`} className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-black transition ${active ? "border-slate-800 bg-slate-800 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}>
            {item.code === "S500" ? <FaTint /> : <FaGasPump />}
            {item.code}
          </Link>
        );
      })}
    </div>
  );
}

function statusBadge(status) {
  const tone = status === "Critico" ? "bg-rose-50 text-rose-700" : status === "Atencao" ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700";
  return <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-black uppercase tracking-wider ${tone}`}>{status === "OK" ? <FaCheckCircle /> : <FaExclamationTriangle />}{status || "OK"}</span>;
}

export default function EstoqueDieselOperacao() {
  const params = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();

  const year = params.ano || "2026";
  const month = params.mes || todayISO().slice(5, 7);
  const productParam = searchParams.get("produto") || "S500";
  const product = productParam in PRODUCT_CONFIG ? productParam : "S500";

  const [entries, setEntries] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [paramStore, setParamStore] = useState(DEFAULT_PARAMS);
  const [metadata, setMetadata] = useState(null);
  const [form, setForm] = useState(() => buildDefaultForm(product, todayISO(), []));
  const [feedback, setFeedback] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function reload(nextProduct = product, keepForm = false) {
    try {
      setLoading(true);
      setFeedback(null);
      const context = await fetchMeasurementContext();
      const [nextEntries, nextReceipts] = await Promise.all([
        fetchMeasurementEntries({ year, metadata: context.metadata, paramStore: context.paramStore, includePumps: true }),
        fetchDieselReceipts({ year, metadata: context.metadata, paramStore: context.paramStore }),
      ]);
      setMetadata(context.metadata);
      setParamStore(context.paramStore);
      setEntries(nextEntries);
      setReceipts(nextReceipts);
      if (!keepForm) setForm(buildDefaultForm(nextProduct, todayISO(), nextEntries));
    } catch (error) {
      console.error("Erro EstoqueDieselOperacao:", error);
      setFeedback({ type: "error", message: error?.message || "Não foi possível carregar os dados do Supabase." });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload(product, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month, product]);

  const productParams = paramStore[product] || DEFAULT_PARAMS[product];
  const previousEntry = useMemo(() => getPreviousEntry(entries, product, form.date, form.id), [entries, form.date, form.id, product]);
  const dailyReceipts = useMemo(() => getDailyReceipts(receipts, product, form.date), [receipts, product, form.date]);
  const computed = useMemo(() => computeMeasurement(form, productParams, previousEntry, dailyReceipts), [form, productParams, previousEntry, dailyReceipts]);
  const validation = useMemo(() => validateMeasurement(form, computed, productParams), [form, computed, productParams]);
  const status = useMemo(() => measurementStatus(computed, productParams), [computed, productParams]);

  const monthlyEntries = useMemo(() => entries.filter((entry) => entry.product === product && entry.date?.startsWith(`${year}-${month}`)).sort((a, b) => new Date(`${b.date}T00:00:00`) - new Date(`${a.date}T00:00:00`)), [entries, product, year, month]);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updatePump(index, field, value) {
    setForm((current) => ({
      ...current,
      pumps: current.pumps.map((pump, pumpIndex) => pumpIndex === index ? { ...pump, [field]: value } : pump),
    }));
  }

  async function handleSave() {
    if (Object.keys(validation.errors).length) {
      setFeedback({ type: "error", message: Object.values(validation.errors)[0] });
      return;
    }

    try {
      setSaving(true);
      await saveMeasurementEntry({ form, computed, product, metadata, userId: Number.isInteger(user?.usuario_id) ? user.usuario_id : null });
      await reload(product, false);
      setFeedback({ type: "success", message: "Lançamento salvo no Supabase." });
    } catch (error) {
      console.error("Erro ao salvar lançamento:", error);
      setFeedback({ type: "error", message: error?.message || "Não foi possível salvar o lançamento." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <EstoqueDieselPageShell title="Lançamento do Dia" description={`Fechamento diário de ${PRODUCT_CONFIG[product].label}: D-1 automático, recebimentos do dia, bombas e Transnet.`}>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
        <SummaryCard title="Produto" value={product} tone="blue" />
        <SummaryCard title="Data" value={formatDate(form.date)} tone="slate" />
        <SummaryCard title="Status" value={status.label} tone={status.tone} />
        <SummaryCard title="Recebimentos do dia" value={`${dailyReceipts.length} / ${parseLiters(computed.entradaDiesel)}`} tone="emerald" />
      </div>

      <EstoqueDieselPanel className="p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <Link to={`/estoque-diesel/resumo?produto=${product}`} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-50"><FaArrowLeft /> Tela inicial do módulo</Link>
            <h2 className="mt-4 text-lg font-black text-slate-800">{getMonthLabel(month)} / {year}</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">Essa é a tela secundária: somente o lançamento diário do mês aberto.</p>
          </div>
          <div className="flex flex-col gap-3 md:items-end">
            <ProductSwitcher product={product} year={year} month={month} />
            <Link to={`/estoque-diesel/recebimento?produto=${product}`} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-3 text-sm font-black text-white transition hover:bg-blue-600"><FaPlus /> Recebimento de Diesel</Link>
          </div>
        </div>
      </EstoqueDieselPanel>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <EstoqueDieselPanel className="p-5 xl:col-span-2">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-lg font-black text-slate-800">Lançamento do dia</h2>
              <p className="mt-1 text-sm font-semibold text-slate-500">Digite somente a medição atual, encerrante das bombas e saída Transnet. O D-1 vem automático.</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black uppercase tracking-wider text-slate-500">D-1 automático</div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <FormInput label="Data" type="date" value={form.date} onChange={(value) => setForm(buildDefaultForm(product, value, entries))} required />
            <FormInput label="Medição D-1 automática" value={computed.medicaoD1} onChange={() => {}} disabled />
            <FormInput label="Recebimento do dia" value={computed.entradaDiesel} onChange={() => {}} disabled />
            <FormInput label="Medição atual T1 (cm)" value={form.reguaAtualT1} onChange={(value) => updateField("reguaAtualT1", value)} required />
            <FormInput label="Medição atual T2 (cm)" value={form.reguaAtualT2} onChange={(value) => updateField("reguaAtualT2", value)} />
            <FormInput label="Saída Transnet (litros)" value={form.transnetOutput} onChange={(value) => updateField("transnetOutput", value)} />
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-500">Bombas do produto</h3>
              <p className="mt-1 text-xs font-bold text-slate-500">S500 usa bombas 2 e 3. S10 usa bomba 1.</p>
              <div className="mt-4 space-y-4">
                {form.pumps.map((pump, index) => (
                  <div key={pump.number} className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-black text-slate-800">Bomba {pump.number}</p>
                      <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-slate-500">Saída {parseLiters(computed.pumpDetails[index]?.output)}</div>
                    </div>
                    <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                      <FormInput label="Encerrante D-1 automático" value={pump.initial} onChange={() => {}} disabled />
                      <FormInput label="Encerrante atual" value={pump.final} onChange={(value) => updatePump(index, "final", value)} required />
                    </div>
                    {validation.errors[`pump_${pump.number}`] ? <p className="mt-2 text-xs font-bold text-rose-600">{validation.errors[`pump_${pump.number}`]}</p> : null}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-500">Observação do dia</h3>
              <textarea value={form.observation} onChange={(event) => updateField("observation", event.target.value)} rows={8} className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100" placeholder="Use este campo quando a divergência passar do limite ou houver qualquer fato operacional relevante." />
              <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700">Fórmula: <span className="font-black">D-1 + Recebimento - Medição atual = Saída tanque</span></div>
              {validation.errors.reguaAtual ? <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{validation.errors.reguaAtual}</div> : null}
              {validation.warnings.length > 0 ? <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700"><div className="flex items-center gap-2 font-black"><FaExclamationTriangle /> Validações do dia</div><ul className="mt-2 space-y-1">{validation.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></div> : null}
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-sm font-semibold text-slate-600">O sistema calcula tanque, bombas, recebimento e diferença Transnet automaticamente.</div>
            <button type="button" onClick={handleSave} disabled={saving || loading} className="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-3 text-sm font-black text-white transition hover:bg-slate-700 disabled:opacity-60"><FaSave />{saving ? "Salvando..." : "Salvar lançamento"}</button>
          </div>

          {feedback ? <div className={`mt-4 rounded-xl border px-4 py-3 text-sm font-semibold ${feedback.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700"}`}>{feedback.message}</div> : null}
        </EstoqueDieselPanel>

        <EstoqueDieselPanel className="p-5">
          <h2 className="text-lg font-black text-slate-800">Resumo calculado</h2>
          <div className="mt-4 space-y-3">
            <SummaryCard title="Medição D-1" value={parseLiters(computed.medicaoD1)} tone="slate" />
            <SummaryCard title="Recebimento do dia" value={parseLiters(computed.entradaDiesel)} tone="emerald" />
            <SummaryCard title="Medição atual" value={parseLiters(computed.medicaoAtual)} tone="blue" />
            <SummaryCard title="Saída tanque" value={parseLiters(computed.saidaTanque)} tone="amber" />
            <SummaryCard title="Saída total bombas" value={parseLiters(computed.saidaTotalBombas)} tone="amber" />
            <SummaryCard title="Saída Transnet" value={parseLiters(computed.saidaTransnet)} tone="amber" />
            <SummaryCard title="Dif. tanque x Transnet" value={parseLiters(computed.diffTanqueTransnet)} tone="slate" />
            <SummaryCard title="Dif. bombas x Transnet" value={parseLiters(computed.diffBombasTransnet)} tone="slate" />
            <SummaryCard title="Dif. tanque x bombas" value={parseLiters(computed.diffTanqueBombas)} tone="slate" />
            <SummaryCard title="% Dif. tanque x Transnet" value={parsePct(computed.pctDiffTransnet)} tone="slate" />
          </div>
        </EstoqueDieselPanel>
      </div>

      <EstoqueDieselPanel className="p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div><h2 className="text-lg font-black text-slate-800">Tabela do mês</h2><p className="mt-1 text-sm font-semibold text-slate-500">Histórico consolidado de {getMonthLabel(month)} de {year} para {product}.</p></div>
          <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black uppercase tracking-wider text-slate-500"><FaInfoCircle /> 1 linha por dia</div>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-black uppercase tracking-wider text-slate-500"><tr>{["Data", "D-1", "Recebimento", "Med. atual", "Saída tanque", "Bombas", "Transnet", "Dif. T x Transnet", "Dif. B x Transnet", "Status"].map((header, index, array) => <th key={header} className={`px-4 py-3 ${index === 0 ? "rounded-l-2xl" : ""} ${index === array.length - 1 ? "rounded-r-2xl" : ""}`}>{header}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100">
              {monthlyEntries.length === 0 ? <tr><td colSpan={10} className="px-4 py-8 text-center text-sm font-semibold text-slate-500">{loading ? "Carregando lançamentos..." : "Ainda não há lançamentos para este mês."}</td></tr> : monthlyEntries.map((entry) => (
                <tr key={entry.id}>
                  <td className="px-4 py-3 font-black text-slate-800">{formatDate(entry.date)}</td>
                  <td className="px-4 py-3 font-semibold text-slate-600">{parseLiters(entry.medicaoD1)}</td>
                  <td className="px-4 py-3 font-semibold text-slate-600">{parseLiters(entry.entradaDiesel)}</td>
                  <td className="px-4 py-3 font-semibold text-slate-600">{parseLiters(entry.medicaoAtual)}</td>
                  <td className="px-4 py-3 font-semibold text-slate-600">{parseLiters(entry.saidaTanque)}</td>
                  <td className="px-4 py-3 font-semibold text-slate-600">{parseLiters(entry.saidaTotalBombas)}</td>
                  <td className="px-4 py-3 font-semibold text-slate-600">{parseLiters(entry.saidaTransnet)}</td>
                  <td className="px-4 py-3 font-semibold text-slate-600">{parseLiters(entry.diffTanqueTransnet)}</td>
                  <td className="px-4 py-3 font-semibold text-slate-600">{parseLiters(entry.diffBombasTransnet)}</td>
                  <td className="px-4 py-3">{statusBadge(entry.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </EstoqueDieselPanel>
    </EstoqueDieselPageShell>
  );
}
