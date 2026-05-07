import { useState } from "react";
import {
  FaBalanceScale,
  FaBell,
  FaTruckLoading,
} from "react-icons/fa";
import EstoqueDieselPageShell, {
  EstoqueDieselPanel,
} from "../../components/estoque-diesel/EstoqueDieselPageShell";

const TABS = [
  { key: "conciliacao", label: "Conciliacao", icon: <FaBalanceScale /> },
  { key: "programacao", label: "Programacao", icon: <FaTruckLoading /> },
  { key: "alertas", label: "Alertas", icon: <FaBell /> },
];

const conciliacaoHeaders = [
  "Data",
  "Entrada abastecimento",
  "Saida abastecimento",
  "Saldo abastecimento",
  "Med. externa",
  "Entrada suprimentos",
  "Saida suprimentos",
  "Saldo suprimentos",
  "Status",
];

const conciliacaoRows = [
  ["Dia selecionado", "Tanque", "Bombas e sistema", "Saldo do fechamento", "Inventario fisico", "Entrada do suprimentos", "Saida valorizada", "Saldo contabil", "OK / Atencao / Critico"],
];

const programacaoProdutos = [
  {
    produto: "S500",
    origem: "Programacao tanque s500",
    campos: ["Data", "Preco diesel", "Defasagem CBIE", "Defasagem em R$", "Indicador de nivel de estoque"],
  },
  {
    produto: "S10",
    origem: "Programacao tanque s10",
    campos: ["Data", "Preco diesel", "Defasagem CBIE", "Defasagem em R$", "Indicador de nivel de estoque"],
  },
  {
    produto: "ARLA",
    origem: "Programacao arla",
    campos: ["Saldo planejado", "Programacao de entrega", "Saldo pos entrega", "Saida programada", "Preco por litro"],
  },
];

const alertas = [
  {
    titulo: "Recebimento fora da faixa",
    detalhe: "Volume descarregado menor que a tolerancia aceitavel da NF.",
    destino: "Abrir tratativa para suprimentos",
  },
  {
    titulo: "Saldo tanque x medicao externa",
    detalhe: "Fechamento fisico fora da diferenca permitida.",
    destino: "Inventario e justificativa",
  },
  {
    titulo: "Saldo abastecimento x saldo suprimentos",
    detalhe: "Operacao do tanque nao bate com a posicao contabil do dia.",
    destino: "Conciliacao critica",
  },
  {
    titulo: "Estoque abaixo do minimo",
    detalhe: "Cobertura real ficou abaixo do piso definido em parametros.",
    destino: "Programacao de compra imediata",
  },
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

function Conciliacao() {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <EstoqueDieselPanel className="p-5 xl:col-span-2">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-lg font-black text-slate-800">Consolidado da conciliacao</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              Esta tela junta as abas "Saldo Abastecimento", "Saldo de Tanque" e "Entrada e Saida Por Dia".
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black uppercase tracking-wider text-slate-500">
            Abastecimento x suprimentos
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-black uppercase tracking-wider text-slate-500">
              <tr>
                {conciliacaoHeaders.map((header, index) => (
                  <th
                    key={header}
                    className={`px-4 py-3 ${index === 0 ? "rounded-l-2xl" : ""} ${
                      index === conciliacaoHeaders.length - 1 ? "rounded-r-2xl" : ""
                    }`}
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {conciliacaoRows.map((row) => (
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

      <EstoqueDieselPanel className="p-5">
        <h2 className="text-lg font-black text-slate-800">Regras da conciliacao</h2>
        <div className="mt-4 space-y-3">
          {[
            "Saldo abastecimento = entrada - saida do tanque",
            "Saldo suprimentos = entrada valorizada - saida valorizada",
            "Medicao externa confronta o saldo fisico do dia",
            "Status final depende da diferenca entre os mundos",
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
        <h2 className="text-lg font-black text-slate-800">Saidas esperadas</h2>
        <div className="mt-4 space-y-3">
          {[
            "Dia conciliado sem diferenca relevante",
            "Dia com ajuste operacional ou inventario",
            "Dia com divergencia critica para suprimentos",
            "Dia travado por falta de lancamento",
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
  );
}

function Programacao() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {programacaoProdutos.map((item) => (
          <EstoqueDieselPanel key={item.produto} className="p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-black text-slate-800">{item.produto}</h2>
                <p className="mt-1 text-sm font-semibold text-slate-500">{item.origem}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black uppercase tracking-wider text-slate-500">
                Programacao
              </div>
            </div>
            <div className="mt-4 space-y-3">
              {item.campos.map((field) => (
                <div
                  key={field}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600"
                >
                  {field}
                </div>
              ))}
            </div>
          </EstoqueDieselPanel>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <EstoqueDieselPanel className="p-5">
          <h2 className="text-lg font-black text-slate-800">Leitura de estoque</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-black uppercase tracking-wider text-slate-500">
                <tr>
                  {["Regra", "S500", "S10", "Total"].map((header, index) => (
                    <th
                      key={header}
                      className={`px-4 py-3 ${index === 0 ? "rounded-l-2xl" : ""} ${
                        index === 3 ? "rounded-r-2xl" : ""
                      }`}
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[
                  ["Estoque minimo", "14.000", "10.000", "24.000"],
                  ["Estoque medio", "30.000", "15.000", "45.000"],
                  ["Estoque maximo", "47.000", "10.000", "57.000"],
                ].map((row) => (
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

        <EstoqueDieselPanel className="p-5">
          <h2 className="text-lg font-black text-slate-800">O que o Inove precisa sugerir</h2>
          <div className="mt-4 space-y-3">
            {[
              "Cobertura em dias por produto",
              "Data sugerida de compra",
              "Volume ideal para voltar ao estoque medio ou maximo",
              "Fornecedor e preco de referencia do dia",
              "Indicador de nivel de estoque: alto ou baixo",
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
    </div>
  );
}

function Alertas() {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <EstoqueDieselPanel className="p-5">
        <h2 className="text-lg font-black text-slate-800">Fila tratavel do suprimentos</h2>
        <div className="mt-4 space-y-3">
          {alertas.map((item) => (
            <div key={item.titulo} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-black text-slate-800">{item.titulo}</h3>
                  <p className="mt-1 text-sm font-semibold text-slate-600">{item.detalhe}</p>
                </div>
                <div className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-rose-700">
                  Alerta
                </div>
              </div>
              <div className="mt-3 rounded-xl border border-white bg-white px-3 py-2 text-xs font-black uppercase tracking-wider text-slate-500">
                Destino: {item.destino}
              </div>
            </div>
          ))}
        </div>
      </EstoqueDieselPanel>

      <EstoqueDieselPanel className="p-5">
        <h2 className="text-lg font-black text-slate-800">Tratamento esperado</h2>
        <div className="mt-4 space-y-3">
          {[
            "Classificar severidade: atencao ou critico",
            "Definir responsavel",
            "Registrar justificativa e acao",
            "Marcar resolucao e data de encerramento",
            "Voltar a conciliacao se o alerta afetar o saldo",
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
  );
}

export default function EstoqueDieselPlanejamentoControle() {
  const [activeTab, setActiveTab] = useState("conciliacao");

  return (
    <EstoqueDieselPageShell
      title="Planejamento e Controle"
      description="Frente do suprimentos para conciliar operacao, programar compras e tratar alertas exatamente como nas planilhas de controle."
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

      {activeTab === "conciliacao" ? <Conciliacao /> : null}
      {activeTab === "programacao" ? <Programacao /> : null}
      {activeTab === "alertas" ? <Alertas /> : null}
    </EstoqueDieselPageShell>
  );
}
