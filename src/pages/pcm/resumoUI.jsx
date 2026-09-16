// Peças visuais dos Resumos do PCM (Preventivas e Pneus), para as duas telas
// terem a mesma cara: cartão, indicador (KPI), medidor e legenda.
import { FaCheckCircle, FaExclamationTriangle, FaClock, FaBus } from "react-icons/fa";

export const fmtInt = (n) => Number(n || 0).toLocaleString("pt-BR");
export const pctDe = (a, b) => (b ? (a / b) * 100 : null);
export const fmtPct = (p, casas = 0) =>
  p == null ? "—" : `${p.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`;
// Hífen não-quebrável: o número do carro nunca parte em duas linhas.
export const semQuebra = (s) => String(s ?? "").replace(/-/g, "‑");

// Cores de estado (validadas p/ daltonismo nos dois temas): bom = verde,
// problema = vermelho, resto = trilho neutro. Sempre com ícone ou texto junto.
export const COR_BOA = "bg-emerald-600";
export const COR_RUIM = "bg-red-600 dark:bg-red-500";
export const COR_NEUTRA = "bg-gray-200 dark:bg-gray-700";

export const TOM = {
  bom: { chip: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300", Icone: FaCheckCircle },
  alerta: { chip: "bg-amber-50 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300", Icone: FaClock },
  critico: { chip: "bg-red-50 text-red-700 dark:bg-red-900/40 dark:text-red-300", Icone: FaExclamationTriangle },
  neutro: { chip: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300", Icone: FaBus },
};

export function Cartao({ titulo, sub, acao, children, className = "", cartaoRef }) {
  return (
    <section
      ref={cartaoRef}
      className={`rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm ${className}`}
    >
      <header className="flex flex-wrap items-start justify-between gap-2 px-4 pt-4 pb-3">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100">{titulo}</h3>
          {sub && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{sub}</p>}
        </div>
        {acao}
      </header>
      <div className="px-4 pb-4">{children}</div>
    </section>
  );
}

// Medidor: o trilho é um passo claro da mesma cor do preenchimento.
export function Medidor({ valor, total, className = "" }) {
  const p = total ? Math.min(100, (valor / total) * 100) : 0;
  return (
    <div className={`h-1.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 overflow-hidden ${className}`}>
      <div className="h-full rounded-full bg-emerald-600 transition-all" style={{ width: `${p}%` }} />
    </div>
  );
}

export function Kpi({ rotulo, valor, complemento, detalhe, tom = "neutro", IconeProprio, medidor, onClick }) {
  const t = TOM[tom] || TOM.neutro;
  const Icone = IconeProprio || t.Icone;
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`text-left rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm p-4 flex flex-col gap-2 ${
        onClick ? "hover:border-emerald-400 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 transition" : ""
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">{rotulo}</span>
        <span className={`w-7 h-7 shrink-0 rounded-lg grid place-items-center text-sm ${t.chip}`} aria-hidden>
          <Icone />
        </span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-3xl font-bold text-gray-900 dark:text-gray-50 leading-none">{valor}</span>
        {complemento && <span className="text-sm font-medium text-gray-500 dark:text-gray-400">{complemento}</span>}
      </div>
      {medidor && <Medidor valor={medidor.valor} total={medidor.total} />}
      {detalhe && <span className="text-xs text-gray-500 dark:text-gray-400">{detalhe}</span>}
    </Tag>
  );
}

export function Legenda({ itens }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-gray-500 dark:text-gray-400">
      {itens.map(([cor, txt]) => (
        <span key={txt} className="inline-flex items-center gap-1.5">
          <span className={`w-2.5 h-2.5 rounded-sm ${cor}`} aria-hidden />
          {txt}
        </span>
      ))}
    </div>
  );
}
