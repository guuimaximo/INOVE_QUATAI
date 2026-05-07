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

const resumoProdutos = [
  {
    produto: "S500",
    tanque: "2 tanques operacionais",
    saldoTanque: "29.446 L",
    saldoSuprimentos: "30.627 L",
    cobertura: "3,2 dias",
    compra: "Programada para amanha",
    status: "Ajustado ao maximo operacional",
  },
  {
    produto: "S10",
    tanque: "2 tanques operacionais",
    saldoTanque: "18.053 L",
    saldoSuprimentos: "18.878 L",
    cobertura: "2,1 dias",
    compra: "Sem compra aberta",
    status: "Abaixo do ponto medio",
  },
  {
    produto: "ARLA",
    tanque: "1 reservatorio",
    saldoTanque: "1.027 L",
    saldoSuprimentos: "1.027 L",
    cobertura: "4,0 dias",
    compra: "Entrega semanal",
    status: "Dentro da programacao",
  },
];

const divergencias = [
  {
    processo: "NF x recebido",
    leitura: "Compara programacao, NF e litros recebidos",
    origem: "Controle Diesel Quatai",
    acao: "Abrir alerta se passar da faixa aceitavel",
  },
  {
    processo: "Saldo tanque x medicao externa",
    leitura: "Confere saldo teorico com saldo medido",
    origem: "Controle Diesel Quatai + medicao externa",
    acao: "Tratar inventario e registrar justificativa",
  },
  {
    processo: "Saldo abastecimento x saldo suprimentos",
    leitura: "Cruza a operacao do tanque com a planilha de controle",
    origem: "Controle e Programacao Diesel",
    acao: "Apontar diferenca operacional ou contabil",
  },
  {
    processo: "Cobertura x regra de estoque",
    leitura: "Compara saldo atual com minimo, medio e maximo",
    origem: "Regras de Estoque",
    acao: "Gerar compra, alerta ou bloqueio de entrega",
  },
];

export default function EstoqueDieselResumo() {
  return (
    <EstoqueDieselPageShell
      title="Resumo Suprimentos"
      description="Painel executivo que junta operacao do tanque, conciliacao diaria e programacao de compra como nas planilhas."
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <EstoqueDieselStat
          title="Saldo de tanque"
          value="S500 / S10 / ARLA"
          sub="Ultimo fechamento por produto"
          icon={<FaTint />}
          tone="blue"
        />
        <EstoqueDieselStat
          title="Cobertura"
          value="7d e 30d"
          sub="Consumo real para compra"
          icon={<FaChartLine />}
          tone="emerald"
        />
        <EstoqueDieselStat
          title="Divergencias"
          value="Tanque x NF"
          sub="Recebimento, medicao e inventario"
          icon={<FaBalanceScale />}
          tone="amber"
        />
        <EstoqueDieselStat
          title="Compras"
          value="S500 / S10 / ARLA"
          sub="Programacao por produto"
          icon={<FaTruckLoading />}
          tone="slate"
        />
        <EstoqueDieselStat
          title="Alertas"
          value="Fila aberta"
          sub="Acima da tolerancia ou abaixo do minimo"
          icon={<FaExclamationTriangle />}
          tone="rose"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <EstoqueDieselPanel className="p-5 xl:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-slate-800">Resumo por produto</h2>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                Esta leitura nasce da combinacao entre saldo de tanque, saldo de suprimentos e cobertura.
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black uppercase tracking-wider text-slate-500">
              Igual ao olhar executivo das planilhas
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-black uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="rounded-l-2xl px-4 py-3">Produto</th>
                  <th className="px-4 py-3">Tanques</th>
                  <th className="px-4 py-3">Saldo tanque</th>
                  <th className="px-4 py-3">Saldo suprimentos</th>
                  <th className="px-4 py-3">Cobertura</th>
                  <th className="px-4 py-3">Proxima compra</th>
                  <th className="rounded-r-2xl px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {resumoProdutos.map((item) => (
                  <tr key={item.produto} className="bg-white">
                    <td className="px-4 py-3 font-black text-slate-800">{item.produto}</td>
                    <td className="px-4 py-3 font-semibold text-slate-600">{item.tanque}</td>
                    <td className="px-4 py-3 font-semibold text-slate-600">{item.saldoTanque}</td>
                    <td className="px-4 py-3 font-semibold text-slate-600">{item.saldoSuprimentos}</td>
                    <td className="px-4 py-3 font-semibold text-slate-600">{item.cobertura}</td>
                    <td className="px-4 py-3 font-semibold text-slate-600">{item.compra}</td>
                    <td className="px-4 py-3 font-semibold text-slate-600">{item.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </EstoqueDieselPanel>

        <EstoqueDieselPanel className="p-5">
          <h2 className="text-lg font-black text-slate-800">Blocos obrigatorios</h2>
          <div className="mt-4 space-y-3">
            {[
              "Saldo atual por produto e por tanque",
              "Consumo medio 7d e 30d",
              "Cobertura e situacao do estoque",
              "Compras previstas e entregas abertas",
              "Divergencias do dia e inventarios pendentes",
              "Alertas acima da tolerancia ou sem lancamento",
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
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <EstoqueDieselPanel className="p-5">
          <h2 className="text-lg font-black text-slate-800">Como as divergencias nascem</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-black uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="rounded-l-2xl px-4 py-3">Processo</th>
                  <th className="px-4 py-3">Leitura</th>
                  <th className="px-4 py-3">Origem</th>
                  <th className="rounded-r-2xl px-4 py-3">Acao</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {divergencias.map((item) => (
                  <tr key={item.processo}>
                    <td className="px-4 py-3 font-black text-slate-800">{item.processo}</td>
                    <td className="px-4 py-3 font-semibold text-slate-600">{item.leitura}</td>
                    <td className="px-4 py-3 font-semibold text-slate-600">{item.origem}</td>
                    <td className="px-4 py-3 font-semibold text-slate-600">{item.acao}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </EstoqueDieselPanel>

        <EstoqueDieselPanel className="p-5">
          <h2 className="text-lg font-black text-slate-800">Leitura final do cluster</h2>
          <div className="mt-4 space-y-3">
            <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-slate-700">
              <span className="font-black text-blue-800">Planilha 1:</span> a operacao do tanque define entrada, saida,
              saldo e diferenca diaria.
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-slate-700">
              <span className="font-black text-emerald-800">Planilha 2:</span> o suprimentos olha cobertura, programacao,
              valor medio e regra de estoque.
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600">
              O resumo do modulo precisa mostrar os dois mundos juntos, sem separar operacao e suprimentos em planilhas paralelas.
            </div>
          </div>
        </EstoqueDieselPanel>
      </div>
    </EstoqueDieselPageShell>
  );
}
