import { useEffect, useState } from "react";
import { FaSave, FaSlidersH } from "react-icons/fa";
import EstoqueDieselPageShell, {
  EstoqueDieselPanel,
} from "../../components/estoque-diesel/EstoqueDieselPageShell";
import { DEFAULT_PARAMS, PRODUCT_CONFIG, loadParams, saveParams } from "./medicaoModel";

function NumberField({ label, value, onChange, step = "0.0001" }) {
  return (
    <label className="block">
      <span className="text-xs font-black uppercase tracking-wider text-slate-500">{label}</span>
      <input
        type="number"
        value={value}
        step={step}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
      />
    </label>
  );
}

export default function EstoqueDieselParametros() {
  const [params, setParams] = useState(() => loadParams());
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    setParams(loadParams());
  }, []);

  function updateProductField(product, field, value) {
    setParams((current) => ({
      ...current,
      [product]: {
        ...current[product],
        [field]: value,
      },
    }));
  }

  function updateTolerance(product, index, field, value) {
    setParams((current) => ({
      ...current,
      [product]: {
        ...current[product],
        toleranceRows: current[product].toleranceRows.map((row, rowIndex) =>
          rowIndex === index ? { ...row, [field]: value } : row
        ),
      },
    }));
  }

  function handleSave() {
    saveParams(params);
    setFeedback("Parametros salvos. Os calculos da medicao ja passam a usar esses valores.");
  }

  return (
    <EstoqueDieselPageShell
      title="Parametros"
      description="Regras oficiais dos calculos volumetricos e das tolerancias, ja alimentadas para S500 e S10."
    >
      <EstoqueDieselPanel className="p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-black text-slate-800">Base de calculo</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              Estes campos alimentam a conversao regua x litros e os limites de alerta da medicao diaria.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-black uppercase tracking-wider text-blue-700">
            <FaSlidersH />
            Parametros oficiais
          </div>
        </div>
      </EstoqueDieselPanel>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {Object.values(PRODUCT_CONFIG).map((product) => {
          const current = params[product.code] || DEFAULT_PARAMS[product.code];
          return (
            <EstoqueDieselPanel key={product.code} className="p-5">
              <h2 className="text-lg font-black text-slate-800">{product.label}</h2>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                Parametros pre-carregados a partir da planilha de medicao e das regras operacionais.
              </p>

              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                <NumberField label="Diametro (m)" value={current.diameterM} onChange={(value) => updateProductField(product.code, "diameterM", value)} />
                <NumberField label="Comprimento (m)" value={current.lengthM} onChange={(value) => updateProductField(product.code, "lengthM", value)} />
                <NumberField label="Regua maxima (cm)" value={current.maxRuleCm} onChange={(value) => updateProductField(product.code, "maxRuleCm", value)} step="0.1" />
                <NumberField label="% alerta NF" value={current.nfDiffWarnPct} onChange={(value) => updateProductField(product.code, "nfDiffWarnPct", value)} step="0.0001" />
                <NumberField label="% critico NF" value={current.nfDiffCriticalPct} onChange={(value) => updateProductField(product.code, "nfDiffCriticalPct", value)} step="0.0001" />
                <NumberField label="% alerta Transnet" value={current.transnetWarnPct} onChange={(value) => updateProductField(product.code, "transnetWarnPct", value)} step="0.0001" />
                <NumberField label="% critico Transnet" value={current.transnetCriticalPct} onChange={(value) => updateProductField(product.code, "transnetCriticalPct", value)} step="0.0001" />
              </div>

              <div className="mt-5">
                <h3 className="text-sm font-black uppercase tracking-wider text-slate-500">Tolerancia por faixa de NF</h3>
                <div className="mt-3 overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs font-black uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="rounded-l-2xl px-4 py-3">Volume NF</th>
                        <th className="px-4 py-3">% variacao</th>
                        <th className="rounded-r-2xl px-4 py-3">Dif. aceitavel</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {current.toleranceRows.map((row, index) => (
                        <tr key={`${product.code}-${row.nfVolume}`}>
                          <td className="px-4 py-3">
                            <input
                              type="number"
                              value={row.nfVolume}
                              onChange={(event) => updateTolerance(product.code, index, "nfVolume", event.target.value)}
                              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="number"
                              step="0.0001"
                              value={row.variationPct}
                              onChange={(event) => updateTolerance(product.code, index, "variationPct", event.target.value)}
                              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="number"
                              step="0.001"
                              value={row.acceptableDiffLiters}
                              onChange={(event) => updateTolerance(product.code, index, "acceptableDiffLiters", event.target.value)}
                              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </EstoqueDieselPanel>
          );
        })}
      </div>

      <EstoqueDieselPanel className="p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="text-sm font-semibold text-slate-600">
            Ao salvar, a medicao diaria ja passa a usar estes parametros para os calculos automaticos.
          </div>
          <button
            type="button"
            onClick={handleSave}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-3 text-sm font-black text-white transition hover:bg-slate-700"
          >
            <FaSave />
            Salvar parametros
          </button>
        </div>
        {feedback ? (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
            {feedback}
          </div>
        ) : null}
      </EstoqueDieselPanel>
    </EstoqueDieselPageShell>
  );
}
