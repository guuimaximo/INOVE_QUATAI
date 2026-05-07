import { useState } from "react";
import {
  FaFileInvoice,
  FaGasPump,
  FaRulerCombined,
} from "react-icons/fa";
import EstoqueDieselPageShell, {
  EstoqueDieselPanel,
} from "../../components/estoque-diesel/EstoqueDieselPageShell";

const TABS = [
  { key: "lancamento", label: "Lancamento do Dia", icon: <FaGasPump /> },
  { key: "recebimentos", label: "Recebimentos", icon: <FaFileInvoice /> },
  { key: "inventario", label: "Inventario", icon: <FaRulerCombined /> },
];

const lancamentoCampos = [
  "Data",
  "Produto",
  "Programacao de entrega",
  "Fornecedor",
  "NF",
  "Volume previsto",
  "Volume recebido",
  "Medicao dia D-1",
  "Entrada diesel",
  "Medicao atual",
];

const reguaCards = [
  {
    tanque: "Tanque 1",
    anterior: "Saldo anterior T1",
    final: "Saldo final T1",
  },
  {
    tanque: "Tanque 2",
    anterior: "Saldo anterior T2",
    final: "Saldo final T2",
  },
];

const saidaHeaders = [
  "Origem",
  "Medidor inicial",
  "Medidor final",
  "Saida do dia",
  "Observacao",
];

const saidaRows = [
  ["Bomba 1", "Leitura D-1", "Leitura atual", "Final - inicial", "Operacao do abastecimento"],
  ["Bomba 2", "Leitura D-1", "Leitura atual", "Final - inicial", "Operacao do abastecimento"],
  ["Bomba 3", "Leitura D-1", "Leitura atual", "Final - inicial", "Opcional, se existir"],
  ["Transnet", "Saldo D-1", "Saldo atual", "Diferenca do sistema", "Usado no S10"],
];

const recebimentoFaixas = [
  ["5.000 L", "0,0105%", "4,947 L"],
  ["10.000 L", "0,0105%", "9,895 L"],
  ["15.000 L", "0,0105%", "14,842 L"],
  ["20.000 L", "0,0105%", "19,790 L"],
  ["25.000 L", "0,0105%", "24,737 L"],
  ["30.000 L", "0,0105%", "29,685 L"],
  ["35.000 L", "0,0105%", "34,632 L"],
];

const inventarioFluxo = [
  "Ler a regua do tanque no fechamento",
  "Converter regua em litros pela curva oficial",
  "Informar medicao externa",
  "Comparar com saldo teorico do fechamento",
  "Registrar diferenca e justificativa",
];

function TabButton({ active, icon, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-black transition ${
        active
          ? "border-slate-800 bg-slate-800 text-white"
          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function FormField({ label, span = "md:col-span-1" }) {
  return (
    <label className={`block ${span}`}>
      <span className="text-xs font-black uppercase tracking-wider text-slate-500">{label}</span>
      <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-400">
        Preencher no Inove
      </div>
    </label>
  );
}

function LancamentoDia() {
  return (
    <div className="space-y-4">
      <EstoqueDieselPanel className="p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-lg font-black text-slate-800">Cabecalho operacional do dia</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              Espelha o topo das abas mensais de S500 e S10: programacao, fornecedor, NF e medicao do dia.
            </p>
          </div>
          <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-black uppercase tracking-wider text-blue-700">
            Controle Diesel Quatai
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          {lancamentoCampos.map((field) => (
            <FormField key={field} label={field} />
          ))}
        </div>
      </EstoqueDieselPanel>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {reguaCards.map((card) => (
          <EstoqueDieselPanel key={card.tanque} className="p-5">
            <h3 className="text-lg font-black text-slate-800">{card.tanque}</h3>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              O mesmo raciocinio da planilha: saldo anterior e saldo final sempre com regua e litros.
            </p>
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormField label={`${card.anterior} - regua`} />
              <FormField label={`${card.anterior} - litros`} />
              <FormField label={`${card.final} - regua`} />
              <FormField label={`${card.final} - litros`} />
            </div>
          </EstoqueDieselPanel>
        ))}
      </div>

      <EstoqueDieselPanel className="p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-lg font-black text-slate-800">Saidas por bomba e sistema</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              A planilha separa a leitura D-1 da leitura atual para achar a saida real do dia.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black uppercase tracking-wider text-slate-500">
            Bomba, encerrante e Transnet
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-black uppercase tracking-wider text-slate-500">
              <tr>
                {saidaHeaders.map((header, index) => (
                  <th
                    key={header}
                    className={`px-4 py-3 ${index === 0 ? "rounded-l-2xl" : ""} ${
                      index === saidaHeaders.length - 1 ? "rounded-r-2xl" : ""
                    }`}
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {saidaRows.map((row) => (
                <tr key={row[0]}>
                  {row.map((cell, index) => (
                    <td
                      key={`${row[0]}-${index}`}
                      className={`px-4 py-3 ${
                        index === 0 ? "font-black text-slate-800" : "font-semibold text-slate-600"
                      }`}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </EstoqueDieselPanel>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <EstoqueDieselPanel className="p-5">
          <h2 className="text-lg font-black text-slate-800">Calculos que o Inove precisa fechar</h2>
          <div className="mt-4 space-y-3">
            {[
              "Entrada diesel = soma dos litros finais menos soma dos litros anteriores",
              "Diferenca final do recebimento = litros finais - litros anteriores - volume da programacao",
              "Saldo teorico = medicao D-1 + entrada - saida total",
              "Saida total = bombas + Transnet do dia",
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

        <EstoqueDieselPanel className="p-5">
          <h2 className="text-lg font-black text-slate-800">Preview do fechamento diario</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-black uppercase tracking-wider text-slate-500">
                <tr>
                  {["Data", "Produto", "Entrada", "Saida", "Saldo teorico", "Medicao externa", "Status"].map((header, index) => (
                    <th
                      key={header}
                      className={`px-4 py-3 ${index === 0 ? "rounded-l-2xl" : ""} ${
                        index === 6 ? "rounded-r-2xl" : ""
                      }`}
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="px-4 py-3 font-semibold text-slate-600">Dia selecionado</td>
                  <td className="px-4 py-3 font-semibold text-slate-600">S500 ou S10</td>
                  <td className="px-4 py-3 font-semibold text-slate-600">Recebimento consolidado</td>
                  <td className="px-4 py-3 font-semibold text-slate-600">Bombas + sistema</td>
                  <td className="px-4 py-3 font-semibold text-slate-600">Calculado no fechamento</td>
                  <td className="px-4 py-3 font-semibold text-slate-600">Campo de conferenica</td>
                  <td className="px-4 py-3 font-semibold text-slate-600">OK / Atencao / Critico</td>
                </tr>
              </tbody>
            </table>
          </div>
        </EstoqueDieselPanel>
      </div>
    </div>
  );
}

function Recebimentos() {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <EstoqueDieselPanel className="p-5">
        <h2 className="text-lg font-black text-slate-800">Conferencia do recebimento</h2>
        <p className="mt-1 text-sm font-semibold text-slate-500">
          O recebimento nasce no mesmo dia operacional, mas precisa de trilha propria para NF e fornecedor.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          {[
            "Data de recebimento",
            "Produto",
            "Tanque",
            "Fornecedor",
            "Numero da NF",
            "Volume da NF",
            "Volume descarregado",
            "Preco por litro",
            "Diferenca apurada",
            "Status da conferencia",
          ].map((field) => (
            <FormField key={field} label={field} />
          ))}
        </div>
      </EstoqueDieselPanel>

      <EstoqueDieselPanel className="p-5">
        <h2 className="text-lg font-black text-slate-800">Tabela de variacao aceitavel</h2>
        <p className="mt-1 text-sm font-semibold text-slate-500">
          Esta faixa vem diretamente da planilha "Variacao aceitavel Diesel" e deve alimentar a politica do recebimento.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-black uppercase tracking-wider text-slate-500">
              <tr>
                {["Volume NF", "% variacao", "Diferenca aceitavel"].map((header, index) => (
                  <th
                    key={header}
                    className={`px-4 py-3 ${index === 0 ? "rounded-l-2xl" : ""} ${
                      index === 2 ? "rounded-r-2xl" : ""
                    }`}
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recebimentoFaixas.map((row) => (
                <tr key={row[0]}>
                  {row.map((cell) => (
                    <td key={`${row[0]}-${cell}`} className="px-4 py-3 font-semibold text-slate-600">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-slate-700">
          Se o volume descarregado ficar abaixo da diferenca aceitavel, o fluxo precisa bloquear a assinatura da nota e abrir alerta para o suprimentos.
        </div>
      </EstoqueDieselPanel>
    </div>
  );
}

function Inventario() {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <EstoqueDieselPanel className="p-5">
        <h2 className="text-lg font-black text-slate-800">Inventario fisico do tanque</h2>
        <p className="mt-1 text-sm font-semibold text-slate-500">
          Esta aba precisa espelhar a medicao externa e a leitura da regua do fechamento.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          {[
            "Data do inventario",
            "Produto",
            "Tanque",
            "Regua medida",
            "Litros pela curva",
            "Medicao externa",
            "Saldo teorico",
            "Diferenca",
            "Ajuste",
            "Justificativa",
          ].map((field) => (
            <FormField key={field} label={field} />
          ))}
        </div>
      </EstoqueDieselPanel>

      <EstoqueDieselPanel className="p-5">
        <h2 className="text-lg font-black text-slate-800">Passos do inventario</h2>
        <div className="mt-4 space-y-3">
          {inventarioFluxo.map((item) => (
            <div
              key={item}
              className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600"
            >
              {item}
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-black uppercase tracking-wider text-slate-500">Saida final esperada</h3>
          <p className="mt-2 text-sm font-semibold text-slate-600">
            O modulo deve registrar se a diferenca foi operacional, contabil ou fisica, e deixar a justificativa vinculada ao dia e ao tanque.
          </p>
        </div>
      </EstoqueDieselPanel>
    </div>
  );
}

export default function EstoqueDieselOperacao() {
  const [activeTab, setActiveTab] = useState("lancamento");

  return (
    <EstoqueDieselPageShell
      title="Operacao do Tanque"
      description="Fluxo operacional do tanque espelhando as abas mensais de S500 e S10: fechamento diario, recebimento e inventario."
    >
      <EstoqueDieselPanel className="p-5">
        <div className="flex flex-wrap gap-2">
          {TABS.map((tab) => (
            <TabButton
              key={tab.key}
              active={activeTab === tab.key}
              icon={tab.icon}
              label={tab.label}
              onClick={() => setActiveTab(tab.key)}
            />
          ))}
        </div>
      </EstoqueDieselPanel>

      {activeTab === "lancamento" ? <LancamentoDia /> : null}
      {activeTab === "recebimentos" ? <Recebimentos /> : null}
      {activeTab === "inventario" ? <Inventario /> : null}
    </EstoqueDieselPageShell>
  );
}
