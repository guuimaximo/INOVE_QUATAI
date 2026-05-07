import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { FaArrowLeft, FaCamera, FaCheckCircle, FaExclamationTriangle, FaGasPump, FaSave, FaTint } from "react-icons/fa";
import EstoqueDieselPageShell, { EstoqueDieselPanel } from "../../components/estoque-diesel/EstoqueDieselPageShell";
import {
  DEFAULT_PARAMS,
  PRODUCT_CONFIG,
  buildDefaultReceiptForm,
  computeReceipt,
  fetchDieselReceipts,
  fetchMeasurementContext,
  receiptStatus,
  saveDieselReceipt,
  todayISO,
  validateReceipt,
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

function SelectInput({ label, value, options, onChange }) {
  return (
    <label className="block">
      <span className="text-xs font-black uppercase tracking-wider text-slate-500">{label}</span>
      <select value={value || ""} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100">
        <option value="">Selecione</option>
        {(options || []).map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  );
}

function FileInput({ label, onChange, required = false }) {
  return (
    <label className="block">
      <span className="text-xs font-black uppercase tracking-wider text-slate-500">{label}{required ? " *" : ""}</span>
      <div className="mt-2 flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700">
        <FaCamera className="text-slate-400" />
        <input type="file" accept="image/*,.pdf" onChange={(event) => onChange(event.target.files?.[0] || null)} className="w-full text-xs font-bold text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-800 file:px-3 file:py-2 file:text-xs file:font-black file:text-white" />
      </div>
    </label>
  );
}

function ProductSwitcher({ product }) {
  return (
    <div className="flex flex-wrap gap-2">
      {Object.values(PRODUCT_CONFIG).map((item) => {
        const active = item.code === product;
        return (
          <Link key={item.code} to={`/estoque-diesel/recebimento?produto=${item.code}`} className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-black transition ${active ? "border-slate-800 bg-slate-800 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}>
            {item.code === "S500" ? <FaTint /> : <FaGasPump />}
            {item.code}
          </Link>
        );
      })}
    </div>
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

function statusBadge(status) {
  const tone = status === "Critico" ? "bg-rose-50 text-rose-700" : status === "Atencao" ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700";
  return <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-black uppercase tracking-wider ${tone}`}>{status === "OK" ? <FaCheckCircle /> : <FaExclamationTriangle />}{status || "OK"}</span>;
}

export default function EstoqueDieselRecebimento() {
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const productParam = searchParams.get("produto") || "S500";
  const product = productParam in PRODUCT_CONFIG ? productParam : "S500";
  const year = todayISO().slice(0, 4);

  const [metadata, setMetadata] = useState(null);
  const [paramStore, setParamStore] = useState(DEFAULT_PARAMS);
  const [receipts, setReceipts] = useState([]);
  const [form, setForm] = useState(() => buildDefaultReceiptForm(product));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);

  async function reload(resetForm = false) {
    try {
      setLoading(true);
      setFeedback(null);
      const context = await fetchMeasurementContext();
      const nextReceipts = await fetchDieselReceipts({ year, product, metadata: context.metadata, paramStore: context.paramStore });
      setMetadata(context.metadata);
      setParamStore(context.paramStore);
      setReceipts(nextReceipts);
      if (resetForm) setForm(buildDefaultReceiptForm(product));
    } catch (error) {
      console.error("Erro EstoqueDieselRecebimento:", error);
      setFeedback({ type: "error", message: error?.message || "Não foi possível carregar os recebimentos no Supabase." });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setForm(buildDefaultReceiptForm(product));
    reload(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product]);

  const productParams = paramStore[product] || DEFAULT_PARAMS[product];
  const computed = useMemo(() => computeReceipt(form, productParams), [form, productParams]);
  const validation = useMemo(() => validateReceipt(form, computed, productParams), [form, computed, productParams]);
  const status = useMemo(() => receiptStatus(computed, productParams), [computed, productParams]);

  const monthReceipts = useMemo(() => receipts.filter((receipt) => receipt.product === product && receipt.date?.startsWith(form.date.slice(0, 7))).sort((a, b) => new Date(`${b.date}T00:00:00`) - new Date(`${a.date}T00:00:00`)), [receipts, product, form.date]);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSave() {
    if (Object.keys(validation.errors).length) {
      setFeedback({ type: "error", message: Object.values(validation.errors)[0] });
      return;
    }
    try {
      setSaving(true);
      await saveDieselReceipt({ form, computed, product, params: productParams, metadata, userId: Number.isInteger(user?.usuario_id) ? user.usuario_id : null });
      await reload(true);
      setFeedback({ type: "success", message: "Recebimento salvo. Ele já entra automaticamente na conta do dia." });
    } catch (error) {
      console.error("Erro ao salvar recebimento:", error);
      setFeedback({ type: "error", message: error?.message || "Não foi possível salvar o recebimento." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <EstoqueDieselPageShell title="Recebimento de Diesel" description="Lançamento separado do recebimento, com foto da régua antes/depois e cálculo de tolerância contra a NF.">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
        <SummaryCard title="Produto" value={product} tone="blue" />
        <SummaryCard title="Status recebimento" value={status.label} tone={status.tone} />
        <SummaryCard title="Recebido real" value={parseLiters(computed.volumeRecebido)} tone="emerald" />
        <SummaryCard title="Diferença NF" value={parseLiters(computed.diffRecebimento)} tone={status.tone} />
      </div>

      <EstoqueDieselPanel className="p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <Link to={`/estoque-diesel/resumo?produto=${product}`} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-50"><FaArrowLeft /> Tela inicial do módulo</Link>
            <h2 className="mt-4 text-lg font-black text-slate-800">Regras de recebimento</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">Informe NF, fornecedor, régua antes/depois e fotos. O sistema calcula volume recebido e tolerância.</p>
          </div>
          <ProductSwitcher product={product} />
        </div>
      </EstoqueDieselPanel>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <EstoqueDieselPanel className="p-5 xl:col-span-2">
          <h2 className="text-lg font-black text-slate-800">Novo recebimento</h2>
          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <FormInput label="Data" type="date" value={form.date} onChange={(value) => updateField("date", value)} required />
            <SelectInput label="Fornecedor" value={form.supplier} options={productParams.suppliers || []} onChange={(value) => updateField("supplier", value)} />
            <FormInput label="Número NF" type="text" value={form.nfNumero} onChange={(value) => updateField("nfNumero", value)} />
            <FormInput label="Volume NF (litros)" value={form.nfVolumeLitros} onChange={(value) => updateField("nfVolumeLitros", value)} required />
            <FormInput label="Régua antes (cm)" value={form.reguaAntesCm} onChange={(value) => updateField("reguaAntesCm", value)} required />
            <FormInput label="Régua depois (cm)" value={form.reguaDepoisCm} onChange={(value) => updateField("reguaDepoisCm", value)} required />
            <FileInput label="Foto régua antes" required onChange={(file) => updateField("fotoAntesFile", file)} />
            <FileInput label="Foto régua depois" required onChange={(file) => updateField("fotoDepoisFile", file)} />
          </div>

          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-500">Observação do recebimento</h3>
            <textarea value={form.observation} onChange={(event) => updateField("observation", event.target.value)} rows={5} className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100" placeholder="Ex.: diferença de régua, lacre, descarregamento parcial, ocorrência no recebimento." />
          </div>

          {validation.warnings.length ? <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700"><div className="flex items-center gap-2 font-black"><FaExclamationTriangle /> Atenção</div><ul className="mt-2 space-y-1">{validation.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></div> : null}

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-sm font-semibold text-slate-600">Após salvar, o volume recebido entra automaticamente na conta do fechamento diário.</div>
            <button type="button" onClick={handleSave} disabled={saving || loading} className="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-3 text-sm font-black text-white transition hover:bg-slate-700 disabled:opacity-60"><FaSave />{saving ? "Salvando..." : "Salvar recebimento"}</button>
          </div>

          {feedback ? <div className={`mt-4 rounded-xl border px-4 py-3 text-sm font-semibold ${feedback.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700"}`}>{feedback.message}</div> : null}
        </EstoqueDieselPanel>

        <EstoqueDieselPanel className="p-5">
          <h2 className="text-lg font-black text-slate-800">Resumo calculado</h2>
          <div className="mt-4 space-y-3">
            <SummaryCard title="Litros antes" value={parseLiters(computed.litrosAntes)} tone="slate" />
            <SummaryCard title="Litros depois" value={parseLiters(computed.litrosDepois)} tone="blue" />
            <SummaryCard title="Volume recebido" value={parseLiters(computed.volumeRecebido)} tone="emerald" />
            <SummaryCard title="Volume NF" value={parseLiters(form.nfVolumeLitros)} tone="slate" />
            <SummaryCard title="Diferença" value={parseLiters(computed.diffRecebimento)} tone={status.tone} />
            <SummaryCard title="% diferença" value={parsePct(computed.pctDiffRecebimento)} tone={status.tone} />
          </div>
        </EstoqueDieselPanel>
      </div>

      <EstoqueDieselPanel className="p-5">
        <h2 className="text-lg font-black text-slate-800">Recebimentos do mês</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-black uppercase tracking-wider text-slate-500"><tr>{["Data", "Fornecedor", "NF", "Volume NF", "Recebido", "Dif.", "% Dif.", "Fotos", "Status"].map((header, index, array) => <th key={header} className={`px-4 py-3 ${index === 0 ? "rounded-l-2xl" : ""} ${index === array.length - 1 ? "rounded-r-2xl" : ""}`}>{header}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100">
              {monthReceipts.length === 0 ? <tr><td colSpan={9} className="px-4 py-8 text-center text-sm font-semibold text-slate-500">Nenhum recebimento lançado neste mês.</td></tr> : monthReceipts.map((receipt) => (
                <tr key={receipt.id}>
                  <td className="px-4 py-3 font-black text-slate-800">{formatDate(receipt.date)}</td>
                  <td className="px-4 py-3 font-semibold text-slate-600">{receipt.supplier || "--"}</td>
                  <td className="px-4 py-3 font-semibold text-slate-600">{receipt.nfNumero || "--"}</td>
                  <td className="px-4 py-3 font-semibold text-slate-600">{parseLiters(receipt.nfVolumeLitros)}</td>
                  <td className="px-4 py-3 font-semibold text-slate-600">{parseLiters(receipt.volumeRecebido)}</td>
                  <td className="px-4 py-3 font-semibold text-slate-600">{parseLiters(receipt.diffRecebimento)}</td>
                  <td className="px-4 py-3 font-semibold text-slate-600">{parsePct(receipt.pctDiffRecebimento)}</td>
                  <td className="px-4 py-3"><div className="flex gap-2">{receipt.fotoAntesUrl ? <a href={receipt.fotoAntesUrl} target="_blank" rel="noreferrer" className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-black text-slate-700">Antes</a> : null}{receipt.fotoDepoisUrl ? <a href={receipt.fotoDepoisUrl} target="_blank" rel="noreferrer" className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-black text-slate-700">Depois</a> : null}</div></td>
                  <td className="px-4 py-3">{statusBadge(receipt.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </EstoqueDieselPanel>
    </EstoqueDieselPageShell>
  );
}
