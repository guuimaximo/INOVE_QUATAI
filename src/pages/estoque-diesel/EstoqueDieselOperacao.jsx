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

function LancamentoDia() {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <EstoqueDieselPanel className="p-5">
        <h2 className="text-lg font-black text-slate-800">Campos do lancamento diario</h2>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          {[
            "Produto e tanque",
            "Data da operacao",
            "Fornecedor e NF",
            "Volume recebido",
            "Regua inicial e final",
            "Litros calculados",
            "Saida bomba 1, 2 e 3",
            "Saida Transnet",
            "Saldo anterior e final",
            "Observacao do dia",
          ].map((item) => (
            <div key={item} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600">
              {item}
            </div>
          ))}
        </div>
      </EstoqueDieselPanel>

      <EstoqueDieselPanel className="p-5">
        <h2 className="text-lg font-black text-slate-800">Fechamento do dia</h2>
        <div className="mt-4 space-y-3">
          {[
            "Consolidar entrada real do tanque",
            "Somar saidas operacionais do dia",
            "Calcular saldo teorico apos a operacao",
            "Comparar com o saldo medido e classificar o fechamento",
          ].map((item) => (
            <div key={item} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600">
              {item}
            </div>
          ))}
        </div>
      </EstoqueDieselPanel>
    </div>
  );
}

function Recebimentos() {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <EstoqueDieselPanel className="p-5">
        <h2 className="text-lg font-black text-slate-800">Historico de recebimentos</h2>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          {[
            "Produto e tanque",
            "Fornecedor",
            "Numero da NF",
            "Volume da NF",
            "Volume realmente recebido",
            "Preco por litro",
            "Desvio apurado",
            "Status da conferencia",
          ].map((item) => (
            <div key={item} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600">
              {item}
            </div>
          ))}
        </div>
      </EstoqueDieselPanel>

      <EstoqueDieselPanel className="p-5">
        <h2 className="text-lg font-black text-slate-800">Papel no fluxo</h2>
        <div className="mt-4 space-y-3">
          {[
            "Conferir o que veio na NF contra o que entrou no tanque",
            "Aplicar a tolerancia por faixa de recebimento",
            "Guardar o historico comercial e operacional da carga",
          ].map((item) => (
            <div key={item} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600">
              {item}
            </div>
          ))}
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
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          {[
            "Medicao externa",
            "Regua lida",
            "Litros convertidos",
            "Saldo teorico do sistema",
            "Diferenca apurada",
            "Ajuste aplicado",
            "Justificativa do ajuste",
            "Responsavel pela conferencia",
          ].map((item) => (
            <div key={item} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600">
              {item}
            </div>
          ))}
        </div>
      </EstoqueDieselPanel>

      <EstoqueDieselPanel className="p-5">
        <h2 className="text-lg font-black text-slate-800">Objetivo do inventario</h2>
        <div className="mt-4 space-y-3">
          {[
            "Comparar o saldo fisico com o saldo teorico",
            "Explicar e registrar qualquer diferenca relevante",
            "Gerar base confiavel para conciliacao e programacao",
          ].map((item) => (
            <div key={item} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600">
              {item}
            </div>
          ))}
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
      description="Unificamos lancamento do dia, recebimentos e inventario em uma unica frente operacional."
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
