import { useState } from "react";
import {
  FaBalanceScale,
  FaBell,
  FaClipboardCheck,
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
      <EstoqueDieselPanel className="p-5">
        <h2 className="text-lg font-black text-slate-800">Comparacoes automaticas</h2>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          {[
            "NF x volume recebido",
            "Saldo teorico x medicao externa",
            "Saida do tanque x bombas",
            "Saida do tanque x Transnet",
            "Abastecimento x saldo de suprimentos",
            "Diferenca do dia x tolerancia",
          ].map((item) => (
            <div key={item} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600">
              {item}
            </div>
          ))}
        </div>
      </EstoqueDieselPanel>

      <EstoqueDieselPanel className="p-5">
        <h2 className="text-lg font-black text-slate-800">Status sugeridos</h2>
        <div className="mt-4 space-y-3">
          {[
            "OK para fechamento coerente",
            "Atencao para desvio justificavel",
            "Critico para divergencia fora da faixa",
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

function Programacao() {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <EstoqueDieselPanel className="p-5">
        <h2 className="text-lg font-black text-slate-800">Programacao de compra</h2>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          {[
            "Saldo atual por produto",
            "Consumo medio 7d e 30d",
            "Cobertura em dias",
            "Estoque minimo, medio e maximo",
            "Volume sugerido",
            "Data sugerida",
            "Fornecedor previsto",
            "Preco de referencia",
          ].map((item) => (
            <div key={item} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600">
              {item}
            </div>
          ))}
        </div>
      </EstoqueDieselPanel>

      <EstoqueDieselPanel className="p-5">
        <h2 className="text-lg font-black text-slate-800">Base herdada da planilha</h2>
        <div className="mt-4 space-y-3">
          {[
            "Programacao de S500, S10 e ARLA",
            "Entrada e saida por dia",
            "Saldo de abastecimento e suprimentos",
            "Regras de estoque e cobertura",
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

function Alertas() {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <EstoqueDieselPanel className="p-5">
        <h2 className="text-lg font-black text-slate-800">Fila tratavel do suprimentos</h2>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          {[
            "Recebimento fora da tolerancia",
            "Diferenca de inventario",
            "Lancamento faltante do dia",
            "Estoque abaixo do minimo",
            "Estoque acima do maximo",
            "Compra prevista sem acao",
            "Medicao externa divergente",
            "Conciliacao critica",
          ].map((item) => (
            <div key={item} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600">
              {item}
            </div>
          ))}
        </div>
      </EstoqueDieselPanel>

      <EstoqueDieselPanel className="p-5">
        <h2 className="text-lg font-black text-slate-800">Tratamento da fila</h2>
        <div className="mt-4 space-y-3">
          {[
            "Prioridade por severidade",
            "Responsavel pela acao",
            "Justificativa e resolucao",
            "Historico de quem abriu e quem encerrou",
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

export default function EstoqueDieselPlanejamentoControle() {
  const [activeTab, setActiveTab] = useState("conciliacao");

  return (
    <EstoqueDieselPageShell
      title="Planejamento e Controle"
      description="Consolidamos conciliacao, programacao e alertas em uma unica frente de controle do suprimentos."
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
