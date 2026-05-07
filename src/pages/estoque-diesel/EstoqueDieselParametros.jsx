import { FaChartLine, FaRulerCombined, FaSlidersH, FaWarehouse } from "react-icons/fa";
import EstoqueDieselPageShell, {
  EstoqueDieselPanel,
} from "../../components/estoque-diesel/EstoqueDieselPageShell";

export default function EstoqueDieselParametros() {
  return (
    <EstoqueDieselPageShell
      title="Parâmetros"
      description="Tanque, diâmetro, comprimento, curva régua-litros, estoque mínimo/médio/máximo e tolerâncias do módulo."
    >
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <EstoqueDieselPanel className="p-5">
          <h2 className="text-lg font-black text-slate-800">Parâmetros do tanque</h2>
          <div className="mt-4 space-y-3">
            {[
              { icon: <FaWarehouse />, title: "Tanque", text: "Identificação, produto, capacidade e status de uso." },
              { icon: <FaRulerCombined />, title: "Geometria", text: "Diâmetro, raio, comprimento e curva régua-litros." },
              { icon: <FaChartLine />, title: "Regras de estoque", text: "Mínimo, médio, máximo e cobertura desejada." },
              { icon: <FaSlidersH />, title: "Tolerâncias", text: "Recebimento, inventário e divergência operacional aceitável." },
            ].map((item) => (
              <div key={item.title} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700">
                    {item.icon}
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-800">{item.title}</h3>
                    <p className="mt-1 text-sm font-semibold text-slate-600">{item.text}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </EstoqueDieselPanel>

        <EstoqueDieselPanel className="p-5">
          <h2 className="text-lg font-black text-slate-800">Origem direta nas planilhas</h2>
          <div className="mt-4 grid grid-cols-1 gap-3">
            {[
              "Aba `Parametros tanque`",
              "Aba `REGUA E LITROS`",
              "Aba `Regras de Estoque`",
              "Aba `Variação aceitável Diesel`",
            ].map((item) => (
              <div key={item} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600">
                {item}
              </div>
            ))}
          </div>
        </EstoqueDieselPanel>
      </div>
    </EstoqueDieselPageShell>
  );
}
