import { useState } from "react";
import {
  FaInfoCircle,
  FaTimes,
  FaWarehouse,
} from "react-icons/fa";

function FlowStage({ title, description, bullets }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <h3 className="text-sm font-black uppercase tracking-wider text-slate-500">{title}</h3>
      <p className="mt-2 text-sm font-semibold text-slate-600">{description}</p>
      <ul className="mt-3 space-y-2 text-sm font-semibold text-slate-600">
        {bullets.map((bullet) => (
          <li key={bullet} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
            {bullet}
          </li>
        ))}
      </ul>
    </div>
  );
}

function EntenderFluxoModal({ onClose }) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-blue-700">
              <FaInfoCircle /> Entender fluxo
            </div>
            <h2 className="mt-3 text-xl font-black text-slate-800">
              Como as 2 planilhas viram o modulo
            </h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              O objetivo nao e copiar abas. A ideia e transformar operacao do tanque e
              programacao de suprimentos em fluxo continuo dentro do Inove.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
          >
            <FaTimes />
          </button>
        </div>

        <div className="space-y-5 overflow-y-auto bg-slate-50/70 p-5">
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
              <h3 className="text-sm font-black uppercase tracking-wider text-blue-800">
                Planilha 1
              </h3>
              <p className="mt-2 text-lg font-black text-slate-800">Controle Diesel Quatai</p>
              <p className="mt-2 text-sm font-semibold text-slate-600">
                Base operacional do tanque: regua, litros, entradas, saidas por bomba,
                saida Transnet, medicao externa e diferencas do tanque.
              </p>
            </div>

            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <h3 className="text-sm font-black uppercase tracking-wider text-emerald-800">
                Planilha 2
              </h3>
              <p className="mt-2 text-lg font-black text-slate-800">
                Controle e Programacao Diesel
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-600">
                Base do suprimentos: saldo por dia, programacao S500/S10/ARLA, regras de
                estoque, variacao aceitavel e necessidade de compra.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <FlowStage
              title="1. Operacao diaria"
              description="O operador mede o tanque e registra o dia exatamente como na planilha."
              bullets={[
                "Produto, data, NF e fornecedor",
                "Regua anterior e final em T1 e T2",
                "Leituras das bombas e saida Transnet",
                "Calculos automaticos do fechamento",
              ]}
            />

            <FlowStage
              title="2. Fechamento automatico"
              description="A aplicacao converte regua em litros e fecha o dia em tempo real."
              bullets={[
                "Saldo anterior e saldo final",
                "Entrada diesel e medicao D-1",
                "Saida tanque, bombas e Transnet",
                "Diferencas percentuais e alertas",
              ]}
            />

            <FlowStage
              title="3. Historico mensal"
              description="Cada mes de 2026 fica pronto para lancamento e conferencia."
              bullets={[
                "Entrada por mes antes de abrir a medicao",
                "Tabela com todos os dias do periodo",
                "Status por produto e por mes",
                "Base para relatorio e consolidacao depois",
              ]}
            />

            <FlowStage
              title="4. Parametros oficiais"
              description="As regras do tanque e das tolerancias ja ficam alimentadas no modulo."
              bullets={[
                "Geometria do tanque",
                "Curva regua x litros",
                "Limites de divergencia",
                "Fornecedores e faixas de recebimento",
              ]}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export function EstoqueDieselPanel({ children, className = "" }) {
  return (
    <div className={`rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`.trim()}>
      {children}
    </div>
  );
}

export function EstoqueDieselStat({ title, value, sub, icon, tone = "slate" }) {
  const tones = {
    slate: "from-slate-50 to-gray-50 border-slate-200 text-slate-700",
    blue: "from-blue-50 to-cyan-50 border-blue-200 text-blue-700",
    emerald: "from-emerald-50 to-teal-50 border-emerald-200 text-emerald-700",
    amber: "from-amber-50 to-orange-50 border-amber-200 text-amber-700",
    rose: "from-rose-50 to-pink-50 border-rose-200 text-rose-700",
  };

  return (
    <div className={`rounded-2xl border bg-gradient-to-br p-4 shadow-sm ${tones[tone] || tones.slate}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-wider opacity-80">{title}</p>
          <p className="mt-2 text-2xl font-black text-slate-800">{value}</p>
          {sub ? <p className="mt-1 text-[11px] font-bold opacity-80">{sub}</p> : null}
        </div>
        {icon ? (
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/80 bg-white/70 text-lg">
            {icon}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function EstoqueDieselPageShell({ badge, title, description, children }) {
  const [showFlow, setShowFlow] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 p-4 space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">
              {badge || (
                <>
                  <FaWarehouse /> Estoque de Diesel
                </>
              )}
            </div>
            <h1 className="mt-3 text-2xl font-black text-slate-800 md:text-3xl">{title}</h1>
            <p className="mt-1 text-sm font-semibold text-slate-500">{description}</p>
          </div>

          <button
            onClick={() => setShowFlow(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-black text-white transition hover:bg-slate-700"
          >
            <FaInfoCircle />
            Entender fluxo
          </button>
        </div>
      </div>

      {children}

      {showFlow ? <EntenderFluxoModal onClose={() => setShowFlow(false)} /> : null}
    </div>
  );
}
