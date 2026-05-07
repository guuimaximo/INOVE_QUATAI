import {
  FaBalanceScale,
  FaChartLine,
  FaExclamationTriangle,
  FaTint,
  FaTruckLoading,
} from "react-icons/fa";
import EstoqueDieselPageShell, {
  EstoqueDieselPanel,
  EstoqueDieselStat,
} from "../../components/estoque-diesel/EstoqueDieselPageShell";

export default function EstoqueDieselResumo() {
  return (
    <EstoqueDieselPageShell
      title="Resumo Suprimentos"
      description="Painel executivo para saldo atual, cobertura, divergências abertas, compras previstas e consumo por produto."
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <EstoqueDieselStat title="Saldo atual" value="S500 / S10" sub="Tanque e abastecimento" icon={<FaTint />} tone="blue" />
        <EstoqueDieselStat title="Cobertura" value="Em dias" sub="Baseado no consumo real" icon={<FaChartLine />} tone="emerald" />
        <EstoqueDieselStat title="Divergências" value="Abertas" sub="Operação x medição x NF" icon={<FaBalanceScale />} tone="amber" />
        <EstoqueDieselStat title="Compras previstas" value="Agenda" sub="S500, S10 e ARLA" icon={<FaTruckLoading />} tone="slate" />
        <EstoqueDieselStat title="Atenção" value="Críticos" sub="Itens acima da tolerância" icon={<FaExclamationTriangle />} tone="rose" />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <EstoqueDieselPanel className="p-5 xl:col-span-2">
          <h2 className="text-lg font-black text-slate-800">O que este resumo precisa consolidar</h2>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            {[
              "Saldo atual por produto e tanque",
              "Cobertura em dias por produto",
              "Consumo médio 7d e 30d",
              "Compras previstas e entregas programadas",
              "Divergências abertas de operação e inventário",
              "Alertas críticos por estoque ou recebimento",
            ].map((item) => (
              <div key={item} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600">
                {item}
              </div>
            ))}
          </div>
        </EstoqueDieselPanel>

        <EstoqueDieselPanel className="p-5">
          <h2 className="text-lg font-black text-slate-800">Origem nas planilhas</h2>
          <div className="mt-4 space-y-3 text-sm font-semibold text-slate-600">
            <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
              `Controle Diesel Quataí`: tanque, régua, litros, saídas, medição externa e diferenças.
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
              `Controle e Programação Diesel`: saldo, estoque, cobertura, compras e variação aceitável.
            </div>
          </div>
        </EstoqueDieselPanel>
      </div>
    </EstoqueDieselPageShell>
  );
}
