// src/pages/PCMResumo.jsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "../supabase";
import {
  FaSearch,
  FaTimes,
  FaCar,
  FaCalendarAlt,
  FaExclamationTriangle,
  FaChartLine,
  FaRedo,
  FaFilter,
  FaChevronDown,
  FaChevronRight,
  FaClock,
  FaTools,
  FaWrench,
  FaBus,
  FaBolt,
  FaChartPie,
  FaInfoCircle
} from "react-icons/fa";

/* =========================
   HELPERS (datas / números)
========================= */

function toISODate(d) {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
}

function startOfMonthISO(iso) {
  const [y, m] = iso.split("-").map((x) => parseInt(x, 10));
  const d = new Date(y, m - 1, 1);
  return toISODate(d);
}

function endOfMonthISO(iso) {
  const [y, m] = iso.split("-").map((x) => parseInt(x, 10));
  const d = new Date(y, m, 0);
  return toISODate(d);
}

function addDaysISO(iso, days) {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

function fmtBRDate(iso) {
  try {
    if (!iso) return "-";
    const d = new Date(iso.includes("T") ? iso : `${iso}T00:00:00`);
    return d.toLocaleDateString("pt-BR");
  } catch {
    return iso || "-";
  }
}

function fmtBRDateTime(iso) {
  try {
    if (!iso) return "-";
    const d = new Date(iso);
    return d.toLocaleString("pt-BR");
  } catch {
    return iso || "-";
  }
}

function safeNum(n, dec = 2) {
  const v = Number(n);
  if (Number.isNaN(v)) return 0;
  return Number(v.toFixed(dec));
}

function fmtNum(v, dec = 2) {
  return safeNum(v, dec).toLocaleString("pt-BR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

function fmtInt(v) {
  return Math.round(safeNum(v, 0)).toLocaleString("pt-BR");
}

function fmtPct(v) {
  return `${fmtNum(v, 1)}%`;
}

function daysDiff(d1, d2) {
  try {
    const a = new Date(d1).getTime();
    const b = new Date(d2).getTime();
    return Math.max(0, Math.floor((b - a) / (1000 * 60 * 60 * 24)));
  } catch {
    return 0;
  }
}

function monthKeyFromISODate(isoDate) {
  return String(isoDate || "").slice(0, 7);
}

// ✅ Tipo de dia (Dom-Qui=Util, Sex=Sab, Sab=Dom)
function dayTypeFromISO(iso) {
  if (!iso) return "DESCONHECIDO";
  const d = new Date(iso.includes("T") ? iso : `${iso}T00:00:00`);
  const dow = d.getDay(); 
  
  if (dow === 5) return "SABADO";
  if (dow === 6) return "DOMINGO";
  return "UTIL";
}

function bestBaseDateISO(v) {
  return (
    v?.data_entrada ||
    (v?.data_referencia ? `${v.data_referencia}T00:00:00` : null)
  );
}

/* =========================
   COMPONENTES DE UI (Estilo Premium)
========================= */

function Chip({ active, onClick, children, title }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-black transition ${
        active 
          ? "bg-slate-800 text-white border-slate-800 shadow" 
          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
      }`}
    >
      {children}
    </button>
  );
}

function CardKPI({ title, value, sub, icon, tone = "blue", className = "" }) {
  const tones = {
    blue: "from-blue-50 to-cyan-50 border-blue-200 text-blue-700",
    emerald: "from-emerald-50 to-teal-50 border-emerald-200 text-emerald-700",
    amber: "from-amber-50 to-orange-50 border-amber-200 text-amber-700",
    rose: "from-rose-50 to-pink-50 border-rose-200 text-rose-700",
    violet: "from-violet-50 to-fuchsia-50 border-violet-200 text-violet-700",
    slate: "from-slate-50 to-gray-50 border-slate-200 text-slate-700",
  };
  return (
    <div className={`rounded-2xl border bg-gradient-to-br ${tones[tone]} p-4 shadow-sm ${className}`}>
      <div className="flex items-start justify-between gap-3 h-full">
        <div className="flex flex-col justify-between h-full">
          <p className="text-xs font-black uppercase tracking-wider opacity-80">{title}</p>
          <div>
            <p className="text-2xl md:text-3xl font-black mt-2 text-slate-800">{value}</p>
            <p className="text-[11px] mt-1 font-bold opacity-80">{sub}</p>
          </div>
        </div>
        <div className="text-xl mt-1 opacity-80">{icon}</div>
      </div>
    </div>
  );
}

/* =========================
   MINI BARRA (aging)
========================= */

function AgingBar({ buckets }) {
  const total =
    (buckets["0-1"] || 0) +
    (buckets["2-3"] || 0) +
    (buckets["4-7"] || 0) +
    (buckets["8-15"] || 0) +
    (buckets["16+"] || 0);

  const parts = [
    { k: "0-1", label: "0–1", color: "bg-emerald-500" },
    { k: "2-3", label: "2–3", color: "bg-blue-500" },
    { k: "4-7", label: "4–7", color: "bg-amber-400" },
    { k: "8-15", label: "8–15", color: "bg-orange-500" },
    { k: "16+", label: "16+", color: "bg-rose-600" },
  ];

  return (
    <div className="w-full">
      <div className="flex items-center justify-between text-xs font-black text-slate-500 uppercase mb-3">
        <span className="flex items-center gap-2"><FaClock /> Aging (Idade da fila) — Carros Abertos</span>
        <span>Total: {total}</span>
      </div>

      <div className="w-full h-4 rounded-full overflow-hidden border border-slate-200 bg-slate-100 flex shadow-inner">
        {parts.map((p) => {
          const v = buckets[p.k] || 0;
          const w = total ? (v / total) * 100 : 0;
          return (
            <div
              key={p.k}
              style={{ width: `${w}%`, display: w === 0 ? "none" : "block" }}
              className={`h-full ${p.color} transition-all duration-500`}
              title={`${p.label} dias: ${v} veículos`}
            />
          );
        })}
      </div>

      <div className="mt-4 grid grid-cols-2 md:grid-cols-5 gap-3">
        {parts.map((p) => (
          <div
            key={p.k}
            className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col items-center justify-center shadow-sm"
          >
            <div className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
              {p.label} dias
            </div>
            <div className="text-xl font-black text-slate-800">{buckets[p.k] || 0}</div>
          </div>
        ))}
      </div>
      <p className="mt-4 text-[10px] text-slate-400 font-bold text-center uppercase tracking-wider">
        * O Aging considera o total real de veículos em aberto hoje (Backlog Geral), ignorando os filtros de período.
      </p>
    </div>
  );
}

/* =========================
   SECTION (collapse)
========================= */

function Section({ title, subtitle, open, onToggle, children, right }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden transition-all">
      <button
        type="button"
        onClick={onToggle}
        className="w-full px-5 py-4 flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors"
      >
        <div className="min-w-0 text-left">
          <div className="text-xs font-black text-slate-500 uppercase tracking-wider flex items-center gap-2">
            {title}
          </div>
          {subtitle ? (
            <div className="text-sm font-bold text-slate-800 truncate mt-1">
              {subtitle}
            </div>
          ) : null}
        </div>
        <div className="flex items-center gap-3 text-slate-400">
          {right}
          {open ? <FaChevronDown /> : <FaChevronRight />}
        </div>
      </button>
      {open ? <div className="px-5 pb-5 pt-2 border-t border-slate-100 bg-slate-50/50">{children}</div> : null}
    </div>
  );
}

/* =========================
   MODAL: EXPLICAÇÃO (POPUP)
========================= */

function ExplicacaoModal({ onClose }) {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm z-[70] animate-in fade-in duration-200 p-4">
      <div className="bg-white p-6 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200">
        
        {/* Cabeçalho */}
        <div className="flex justify-between items-center mb-4 border-b pb-4 shrink-0">
          <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
            <FaInfoCircle className="text-blue-600" /> Dicionário de Indicadores PCM
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-rose-500 hover:bg-rose-50 p-2 rounded-xl transition">
            <FaTimes size={20} />
          </button>
        </div>

        {/* Conteúdo */}
        <div className="overflow-y-auto pr-2 space-y-5 text-sm text-slate-700">
          
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <h3 className="font-black text-slate-800 mb-2 flex items-center gap-2"><FaClock className="text-slate-500"/> O que é o "Aging"? (Idade da Fila)</h3>
            <p className="mb-2">O Aging (Envelhecimento) mede <strong>há quantos dias os veículos estão parados na oficina</strong>. Ele agrupa os carros que estão com a OS "Em Aberto" em diferentes faixas de tempo.</p>
            <ul className="list-disc pl-5 space-y-1 text-xs font-semibold text-slate-600">
              <li><span className="text-emerald-600 font-black">0-1 e 2-3 dias:</span> Fluxo normal. Carros entrando e saindo rapidamente.</li>
              <li><span className="text-amber-600 font-black">4-7 dias:</span> Alerta. Reparos mais complexos ou início de gargalo.</li>
              <li><span className="text-rose-600 font-black">16+ dias:</span> Crítico. Veículos "mofando" na oficina, geralmente aguardando peças complexas ou retífica.</li>
            </ul>
            <p className="mt-3 text-xs italic bg-white p-2 rounded border border-slate-200">
              <strong>Nota importante:</strong> O Aging e o card "Em Aberto" ignoram o filtro de datas do topo e puxam 100% da base real da oficina (backlog), para que carros muito antigos não desapareçam do seu radar.
            </p>
          </div>

          <div className="bg-blue-50 p-4 rounded-xl border border-blue-200">
            <h3 className="font-black text-blue-900 mb-2 flex items-center gap-2"><FaRedo className="text-blue-600"/> Regra de Reincidência (Frotas Reincidentes)</h3>
            <p className="mb-1">Como o painel define que um carro é reincidente?</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>O sistema rastreia o ciclo completo do carro: <strong>Entrou → Foi Liberado (Saiu) → Entrou novamente</strong>.</li>
              <li>Se um carro tem 3 registros no mês, mas a oficina nunca deu "saída" nele, ele conta como 1 única parada longa.</li>
              <li>A reincidência acusa os veículos que foram dados como "prontos", rodaram na rua e quebraram de novo no mesmo período selecionado.</li>
            </ul>
          </div>

          <div className="bg-amber-50 p-4 rounded-xl border border-amber-200">
            <h3 className="font-black text-amber-900 mb-2 flex items-center gap-2"><FaCalendarAlt className="text-amber-600"/> Filtro de Dias (O Calendário Operacional)</h3>
            <p className="mb-2">A operação de manutenção trata os dias de forma diferente do calendário civil:</p>
            <ul className="list-disc pl-5 space-y-1 font-semibold text-xs text-amber-800">
              <li><strong>Domingo a Quinta-feira:</strong> Contam como "Dias Úteis" normais.</li>
              <li><strong>Sexta-feira:</strong> Conta como "Sábado" para fins de análise de planejamento.</li>
              <li><strong>Sábado:</strong> Conta como "Domingo".</li>
            </ul>
          </div>

          <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200">
            <h3 className="font-black text-emerald-900 mb-2 flex items-center gap-2"><FaChartLine className="text-emerald-600"/> Média GNS/Dia</h3>
            <p>Calcula a gravidade diária das quebras severas (GNS - Guarda Não Sai). O cálculo é a divisão do <strong>Total de registros GNS do período</strong> pela quantidade de <strong>Dias que tiveram PCM lançado</strong> no mesmo período. É o principal termômetro de saúde da frota a curto prazo.</p>
          </div>

        </div>

        {/* Rodapé */}
        <div className="mt-5 pt-4 border-t flex justify-end shrink-0">
          <button onClick={onClose} className="px-6 py-2.5 bg-blue-600 text-white font-black rounded-xl hover:bg-blue-700 transition shadow-md active:scale-95">
            Entendi
          </button>
        </div>

      </div>
    </div>
  );
}

/* =========================
   MODAL: DETALHE FROTA
========================= */

function FrotaDetalheModal({ open, onClose, frota, rows, periodo }) {
  if (!open) return null;

  const parseDT = (v) => {
    const base =
      v?.data_entrada ||
      (v?.data_referencia ? `${v.data_referencia}T00:00:00` : null);
    return base ? new Date(base).getTime() : 0;
  };

  const sorted = [...(rows || [])].sort((a, b) => parseDT(a) - parseDT(b));

  const ciclos = sorted.map((r) => {
    const dtIn = r.data_entrada || (r.data_referencia ? `${r.data_referencia}T00:00:00` : null);
    const dtOut = r.data_saida || null;
    const dias = dtIn
      ? daysDiff(dtIn, dtOut ? dtOut : new Date().toISOString())
      : 0;
    return { ...r, _dias: dias };
  });

  return (
    <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-5xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex justify-between items-center p-5 border-b bg-white shrink-0 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-50 to-transparent opacity-50"></div>
          <div className="relative flex items-center gap-3">
            <div className="bg-blue-600 text-white p-2.5 rounded-lg shadow-sm">
              <FaCar size={20} />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-800">
                Detalhe da Frota <span className="text-blue-600">{frota || "-"}</span>
              </h2>
              <div className="text-xs text-slate-500 font-bold mt-1">
                Ciclos e reincidências no período: {fmtBRDate(periodo?.inicio)} → {fmtBRDate(periodo?.fim)}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="relative text-slate-400 hover:text-rose-500 hover:bg-rose-50 p-2 rounded-xl transition">
            <FaTimes size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 bg-slate-50/50 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <CardKPI
              title="Registros"
              value={fmtInt(sorted.length)}
              sub="No período"
              icon={<FaTools />}
              tone="blue"
            />
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col justify-center">
              <div className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Última entrada</div>
              <div className="text-sm font-black text-slate-800">{fmtBRDateTime(sorted?.[sorted.length - 1]?.data_entrada)}</div>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col justify-center">
              <div className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Última saída</div>
              <div className="text-sm font-black text-slate-800">{fmtBRDateTime(sorted?.[sorted.length - 1]?.data_saida) || "—"}</div>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col justify-center items-start">
              <div className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-2">Status Atual</div>
              {sorted?.[sorted.length - 1]?.data_saida ? (
                <span className="bg-emerald-100 text-emerald-700 border border-emerald-200 px-3 py-1 rounded-lg text-xs font-black uppercase tracking-wider">Fechado</span>
              ) : (
                <span className="bg-rose-100 text-rose-700 border border-rose-200 px-3 py-1 rounded-lg text-xs font-black uppercase tracking-wider">Em aberto</span>
              )}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider mb-4 border-b pb-2 flex items-center gap-2">
              <FaWrench className="text-slate-400" /> Linha do Tempo e Descrições
            </h3>
            
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-sm border-collapse min-w-[900px]">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="p-3 font-black">Data Ref</th>
                    <th className="p-3 font-black">Entrada</th>
                    <th className="p-3 font-black">Saída</th>
                    <th className="p-3 text-center font-black">Dias</th>
                    <th className="p-3 font-black">Categoria</th>
                    <th className="p-3 font-black">Setor</th>
                    <th className="p-3 font-black">O.S</th>
                    <th className="p-3 font-black w-[400px]">Descrição</th>
                    <th className="p-3 font-black">Observação</th>
                  </tr>
                </thead>
                <tbody>
                  {ciclos.map((r) => (
                    <tr key={r.id} className="border-b last:border-0 hover:bg-slate-50">
                      <td className="p-3 font-black text-xs text-slate-700">{fmtBRDate(r.data_referencia)}</td>
                      <td className="p-3 text-xs font-semibold text-slate-600">{fmtBRDateTime(r.data_entrada)}</td>
                      <td className="p-3 text-xs font-semibold text-slate-600">{fmtBRDateTime(r.data_saida) || "—"}</td>
                      <td className="p-3 text-center font-black text-rose-600">{r._dias}</td>
                      <td className="p-3"><span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-[10px] font-black">{r.categoria || "-"}</span></td>
                      <td className="p-3 text-xs font-bold text-slate-700">{r.setor || "-"}</td>
                      <td className="p-3 text-xs font-bold text-slate-700">{r.ordem_servico || "-"}</td>
                      <td className="p-3 text-[11px] font-semibold text-slate-600 uppercase">{r.descricao || "-"}</td>
                      <td className="p-3 text-[11px] font-semibold text-slate-600 uppercase">{r.observacao || "-"}</td>
                    </tr>
                  ))}
                  {ciclos.length === 0 && (
                    <tr>
                      <td colSpan={9} className="p-6 text-center text-slate-500 font-bold">Sem registros para esta frota.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-[10px] text-slate-400 font-semibold text-center">
              * Considera registros dentro do período selecionado.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================
   PAGE: PCMResumo
========================= */

const QUICK_PERIODS = [
  { key: "MES_ATUAL", label: "Mês atual" },
  { key: "ULT_30", label: "Últimos 30 dias" },
  { key: "INTERVALO", label: "Intervalo" },
];

const DAY_FILTERS = [
  { key: "ALL", label: "Todos os Dias" },
  { key: "UTIL", label: "Dia útil (Dom a Qui)" },
  { key: "SABADO", label: "Sábado (Ref. Sexta)" },
  { key: "DOMINGO", label: "Domingo (Ref. Sábado)" },
];

export default function PCMResumo() {
  // período
  const hojeISO = useMemo(() => toISODate(new Date()), []);
  const mesAtualIni = useMemo(() => startOfMonthISO(hojeISO), [hojeISO]);
  const mesAtualFim = useMemo(() => endOfMonthISO(hojeISO), [hojeISO]);

  const [periodMode, setPeriodMode] = useState("MES_ATUAL");
  const [inicio, setInicio] = useState(mesAtualIni);
  const [fim, setFim] = useState(mesAtualFim);

  // filtro tipo de dia
  const [dayFilter, setDayFilter] = useState("ALL");

  // UI (reduzir informação)
  const [compact, setCompact] = useState(false); 
  const [secParetoOpen, setSecParetoOpen] = useState(true);
  const [secSerieOpen, setSecSerieOpen] = useState(true);
  const [secTopsOpen, setSecTopsOpen] = useState(true);
  
  // Modal de Explicação
  const [mostrarExplicacao, setMostrarExplicacao] = useState(false);

  // dados
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState("");

  // série mensal
  const [serieMensal, setSerieMensal] = useState([]);

  // base do período e backlog real (para aging)
  const [diasPCM, setDiasPCM] = useState([]);
  const [veiculosPeriodo, setVeiculosPeriodo] = useState([]);
  const [backlogAberto, setBacklogAberto] = useState([]); // ✅ NOVO: Base pura de abertos

  // reincidência
  const [reincidencias, setReincidencias] = useState([]);
  const [reincQuery, setReincQuery] = useState("");

  // top 5
  const [topParado, setTopParado] = useState([]);
  const [topReinc, setTopReinc] = useState([]);

  // detalhe frota
  const [modalOpen, setModalOpen] = useState(false);
  const [modalFrota, setModalFrota] = useState(null);
  const [modalRows, setModalRows] = useState([]);

  const periodoAtual = useMemo(() => ({ inicio, fim }), [inicio, fim]);

  // aplica modo de período
  useEffect(() => {
    if (periodMode === "MES_ATUAL") {
      setInicio(mesAtualIni);
      setFim(mesAtualFim);
    } else if (periodMode === "ULT_30") {
      const ini = addDaysISO(hojeISO, -29);
      setInicio(ini);
      setFim(hojeISO);
    }
  }, [periodMode, hojeISO, mesAtualIni, mesAtualFim]);

  // =========================
  // FETCHERS
  // =========================

  const carregarSerieMensal = useCallback(async () => {
    const { data: pcms, error: e1 } = await supabase
      .from("pcm_diario")
      .select("data_referencia")
      .order("data_referencia", { ascending: true });

    if (e1) throw e1;

    const diasPorMes = new Map();
    (pcms || []).forEach((p) => {
      const mk = monthKeyFromISODate(p.data_referencia);
      diasPorMes.set(mk, (diasPorMes.get(mk) || 0) + 1);
    });

    const { data: veics, error: e2 } = await supabase
      .from("veiculos_pcm")
      .select("categoria, data_entrada, pcm_id")
      .eq("categoria", "GNS");

    if (e2) throw e2;

    const needsPcm = (veics || []).some((v) => !v.data_entrada);
    let pcmMap = new Map();

    if (needsPcm) {
      const pcmIds = Array.from(
        new Set((veics || []).map((v) => v.pcm_id).filter(Boolean))
      );

      const chunkSize = 500;
      for (let i = 0; i < pcmIds.length; i += chunkSize) {
        const chunk = pcmIds.slice(i, i + chunkSize);
        const { data: pcmChunk, error: e3 } = await supabase
          .from("pcm_diario")
          .select("id, data_referencia")
          .in("id", chunk);

        if (e3) throw e3;
        (pcmChunk || []).forEach((p) => pcmMap.set(p.id, p.data_referencia));
      }
    }

    const gnsPorMes = new Map();
    (veics || []).forEach((v) => {
      const dt = v.data_entrada
        ? toISODate(new Date(v.data_entrada))
        : pcmMap.get(v.pcm_id);
      const mk = monthKeyFromISODate(dt);
      if (!mk) return;
      gnsPorMes.set(mk, (gnsPorMes.get(mk) || 0) + 1);
    });

    const meses = Array.from(diasPorMes.keys()).sort();
    const out = meses
      .map((mk) => {
        const dias = diasPorMes.get(mk) || 0;
        const total = gnsPorMes.get(mk) || 0;
        const media = dias ? safeNum(total / dias, 2) : 0;
        return {
          mes: mk,
          dias_com_pcm: dias,
          total_gns: total,
          media_gns_dia: media,
        };
      })
      .reverse();

    setSerieMensal(out.slice(0, 18));
  }, []);

  const carregarPeriodo = useCallback(async () => {
    // 1) Dias com PCM no período
    const { data: pcmsRaw, error: e1 } = await supabase
      .from("pcm_diario")
      .select("id, data_referencia, criado_por")
      .gte("data_referencia", inicio)
      .lte("data_referencia", fim)
      .order("data_referencia", { ascending: true });

    if (e1) throw e1;

    const pcms = dayFilter === "ALL"
        ? pcmsRaw || []
        : (pcmsRaw || []).filter((p) => dayTypeFromISO(p.data_referencia) === dayFilter);

    setDiasPCM(pcms);

    // 2) Veículos que ENTRARAM no período (Para cálculos de volume do mês/período)
    const pcmIds = (pcms || []).map((p) => p.id);
    const [qA, qB, qBacklog] = await Promise.all([
      supabase
        .from("veiculos_pcm")
        .select("id, pcm_id, frota, setor, categoria, ordem_servico, descricao, observacao, data_entrada, data_saida, lancado_por, lancado_no_turno")
        .gte("data_entrada", `${inicio}T00:00:00`)
        .lte("data_entrada", `${fim}T23:59:59`),
      pcmIds.length
        ? supabase
            .from("veiculos_pcm")
            .select("id, pcm_id, frota, setor, categoria, ordem_servico, descricao, observacao, data_entrada, data_saida, lancado_por, lancado_no_turno")
            .is("data_entrada", null)
            .in("pcm_id", pcmIds)
        : Promise.resolve({ data: [], error: null }),
      // ✅ 3) NEW: BACKLOG REAL (Para Aging e Card "Em Aberto" - ignora filtro de data)
      supabase
        .from("veiculos_pcm")
        .select("id, frota, categoria, data_entrada, pcm_diario(data_referencia)")
        .is("data_saida", null)
    ]);

    if (qA.error) throw qA.error;
    if (qB.error) throw qB.error;
    if (qBacklog.error) throw qBacklog.error;

    // Seta o backlog real, pegando data_entrada ou a data_referencia do pcm linkado caso data_entrada não exista
    setBacklogAberto(
      (qBacklog.data || []).map(v => ({
        ...v,
        data_efetiva: v.data_entrada || (v.pcm_diario?.data_referencia ? `${v.pcm_diario.data_referencia}T00:00:00` : null)
      }))
    );

    const all = [...(qA.data || []), ...(qB.data || [])];
    const pcmIdToRef = new Map((pcms || []).map((p) => [p.id, p.data_referencia]));

    const normalized = all.map((v) => ({
      ...v,
      data_referencia: pcmIdToRef.get(v.pcm_id) || null,
    }));

    const normalizedFiltered = dayFilter === "ALL"
        ? normalized
        : normalized.filter((v) => dayTypeFromISO(bestBaseDateISO(v)) === dayFilter);

    setVeiculosPeriodo(normalizedFiltered);

    // 4) Reincidências (entrou -> saiu -> entrou novamente)
    const byFrota = new Map();
    normalizedFiltered.forEach((v) => {
      const f = String(v.frota || "").trim();
      if (!f) return;
      const arr = byFrota.get(f) || [];
      arr.push(v);
      byFrota.set(f, arr);
    });

    const parseIn = (v) => {
      const base = v.data_entrada || (v.data_referencia ? `${v.data_referencia}T00:00:00` : null);
      return base ? new Date(base).getTime() : 0;
    };
    const parseOut = (v) => (v.data_saida ? new Date(v.data_saida).getTime() : null);

    const reinc = [];
    byFrota.forEach((arr, frota) => {
      const sorted = [...arr].sort((a, b) => parseIn(a) - parseIn(b));

      let reentradas = 0;
      for (let i = 1; i < sorted.length; i++) {
        const prevOut = parseOut(sorted[i - 1]);
        const currIn = parseIn(sorted[i]);
        if (prevOut && currIn && currIn > prevOut) reentradas += 1;
      }

      if (reentradas < 1) return;

      const ultimaEntrada = sorted[sorted.length - 1]?.data_entrada || null;
      const diasParadoTotal = sorted.reduce((acc, r) => {
        const dtIn = r.data_entrada || (r.data_referencia ? `${r.data_referencia}T00:00:00` : null);
        const dtOut = r.data_saida || new Date().toISOString();
        if (!dtIn) return acc;
        return acc + daysDiff(dtIn, dtOut);
      }, 0);

      const descricoes = sorted.map((x) => (x.descricao ? String(x.descricao).trim().toUpperCase() : "")).filter(Boolean);

      reinc.push({
        frota,
        entradas: sorted.length,
        reentradas,
        ultimaEntrada,
        diasParadoTotal,
        descricoesPreview: descricoes.slice(0, 3),
      });
    });

    reinc.sort((a, b) => {
      if (b.reentradas !== a.reentradas) return b.reentradas - a.reentradas;
      return b.diasParadoTotal - a.diasParadoTotal;
    });

    setReincidencias(reinc);
    setTopParado([...reinc].sort((a, b) => b.diasParadoTotal - a.diasParadoTotal).slice(0, 5));
    setTopReinc([...reinc].sort((a, b) => b.reentradas - a.reentradas).slice(0, 5));

  }, [inicio, fim, dayFilter]);

  const recarregarTudo = useCallback(async () => {
    setLoading(true);
    setErrMsg("");
    try {
      await Promise.all([carregarSerieMensal(), carregarPeriodo()]);
    } catch (e) {
      console.error(e);
      setErrMsg(e?.message || "Erro ao carregar resumo do PCM.");
    } finally {
      setLoading(false);
    }
  }, [carregarSerieMensal, carregarPeriodo]);

  useEffect(() => {
    recarregarTudo();
  }, [recarregarTudo]);

  // =========================
  // KPI / DERIVADOS
  // =========================

  const kpis = useMemo(() => {
    const diasComPCM = (diasPCM || []).length;
    const totalPeriodo = (veiculosPeriodo || []).length;
    
    // ✅ Em Aberto AGORA USA O BACKLOG REAL (Imune a filtros de data)
    const totalAbertos = backlogAberto.length;

    // O GNS continua refletindo o volume de GNS do período para gerar a média
    const totalGNS = (veiculosPeriodo || []).filter((v) => v.categoria === "GNS").length;
    const pctGNS = totalPeriodo ? safeNum((totalGNS / totalPeriodo) * 100, 1) : 0;
    const mediaGNSDia = diasComPCM ? safeNum(totalGNS / diasComPCM, 2) : 0;
    const frotasReincidentes = (reincidencias || []).length;

    // ✅ AGING AGORA USA O BACKLOG REAL (Imune a filtros de data)
    const buckets = { "0-1": 0, "2-3": 0, "4-7": 0, "8-15": 0, "16+": 0 };
    const now = new Date().toISOString();

    backlogAberto.forEach((v) => {
      const dtIn = v.data_efetiva;
      const dias = dtIn ? daysDiff(dtIn, now) : 0;
      if (dias <= 1) buckets["0-1"] += 1;
      else if (dias <= 3) buckets["2-3"] += 1;
      else if (dias <= 7) buckets["4-7"] += 1;
      else if (dias <= 15) buckets["8-15"] += 1;
      else buckets["16+"] += 1;
    });

    const bySetor = {};
    const byCategoria = {};
    (veiculosPeriodo || []).forEach((v) => {
      const s = v.setor || "—";
      const c = v.categoria || "—";
      bySetor[s] = (bySetor[s] || 0) + 1;
      byCategoria[c] = (byCategoria[c] || 0) + 1;
    });

    const setores = Object.entries(bySetor)
      .map(([k, v]) => ({ setor: k, total: v, pct: totalPeriodo ? safeNum((v / totalPeriodo) * 100, 1) : 0 }))
      .sort((a, b) => b.total - a.total);

    const categorias = Object.entries(byCategoria)
      .map(([k, v]) => ({ categoria: k, total: v, pct: totalPeriodo ? safeNum((v / totalPeriodo) * 100, 1) : 0 }))
      .sort((a, b) => b.total - a.total);

    return {
      diasComPCM, totalPeriodo, totalAbertos, totalGNS, pctGNS, mediaGNSDia,
      frotasReincidentes, aging: buckets, setores, categorias,
    };
  }, [diasPCM, veiculosPeriodo, reincidencias, backlogAberto]);

  const reincFiltradas = useMemo(() => {
    const q = reincQuery.trim().toLowerCase();
    if (!q) return reincidencias || [];
    return (reincidencias || []).filter((r) => String(r.frota).toLowerCase().includes(q));
  }, [reincidencias, reincQuery]);

  const abrirDetalheFrota = useCallback((frota) => {
    const rows = (veiculosPeriodo || []).filter((v) => String(v.frota || "").trim() === String(frota || "").trim());
    setModalFrota(frota);
    setModalRows(rows);
    setModalOpen(true);
  }, [veiculosPeriodo]);

  const fecharModal = useCallback(() => {
    setModalOpen(false);
    setModalFrota(null);
    setModalRows([]);
  }, []);

  return (
    <div className="space-y-6">
      {/* HEADER PREMIUM */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 md:p-5">
        <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-black border border-amber-200">
              <FaBolt /> Resumo PCM / Aging / Reincidência
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-slate-800 mt-3 flex items-center gap-3">
              PAINEL PCM
            </h1>
            <p className="text-sm text-slate-500 mt-1 flex items-center gap-2 font-semibold">
              <FaCalendarAlt /> Período: {fmtBRDate(inicio)} → {fmtBRDate(fim)}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {QUICK_PERIODS.map((p) => (
              <Chip key={p.key} active={periodMode === p.key} onClick={() => setPeriodMode(p.key)} title="Trocar período">{p.label}</Chip>
            ))}

            <button
              onClick={() => setMostrarExplicacao(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-100 text-blue-800 font-bold hover:bg-blue-200 transition"
              title="Entender Cálculos"
            >
              <FaInfoCircle /> Entender Cálculos
            </button>

            <button
              onClick={() => setCompact((v) => !v)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-black transition ${
                !compact ? "bg-slate-100 text-slate-800 hover:bg-slate-200 border-slate-300" : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
              }`}
              title="Alternar modo de visualização"
            >
              <FaFilter /> {compact ? "Expandir Painéis" : "Visão Compacta"}
            </button>

            <button
              onClick={recarregarTudo}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-800 bg-slate-800 text-white font-black hover:bg-slate-700 transition"
              title="Recarregar dados"
            >
              <FaRedo /> Atualizar
            </button>
          </div>
        </div>

        {/* Inputs de Data (Se intervalo) + Filtro Tipo de Dia */}
        <div className="mt-4 pt-4 border-t flex flex-col md:flex-row gap-4 items-start md:items-center">
          {periodMode === "INTERVALO" && (
            <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200">
              <input type="date" className="bg-transparent text-sm font-black text-slate-700 outline-none" value={inicio} onChange={(e) => setInicio(e.target.value)} />
              <span className="text-slate-400 font-bold">até</span>
              <input type="date" className="bg-transparent text-sm font-black text-slate-700 outline-none" value={fim} onChange={(e) => setFim(e.target.value)} />
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {DAY_FILTERS.map((p) => (
              <button
                key={p.key}
                onClick={() => setDayFilter(p.key)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition ${
                  dayFilter === p.key ? "bg-blue-600 text-white shadow" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {errMsg && (
          <div className="mt-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-3 text-sm font-bold flex items-center gap-2">
            <FaExclamationTriangle /> {errMsg}
          </div>
        )}
      </div>

      {/* KPIs PRINCIPAIS */}
      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <CardKPI title="Dias com PCM" value={fmtInt(kpis.diasComPCM)} sub="No período" icon={<FaCalendarAlt />} tone="slate" />
        <CardKPI title="Total Registros" value={fmtInt(kpis.totalPeriodo)} sub="Veículos lançados no período" icon={<FaBus />} tone="blue" />
        <CardKPI title="Em Aberto" value={fmtInt(kpis.totalAbertos)} sub="Realidade Total (Hoje)" icon={<FaTools />} tone="rose" />
        <CardKPI title="Total GNS" value={fmtInt(kpis.totalGNS)} sub={`${kpis.pctGNS}% do período`} icon={<FaChartPie />} tone="emerald" />
        <CardKPI title="Média GNS/Dia" value={kpis.mediaGNSDia} sub="Base mensal/período" icon={<FaChartLine />} tone="violet" />
        <CardKPI title="Frotas Reincidentes" value={fmtInt(kpis.frotasReincidentes)} sub="Entrou → Saiu → Entrou" icon={<FaRedo />} tone="amber" />
      </div>

      {/* AGING E REINCIDÊNCIAS */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* AGING */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm xl:col-span-1 flex flex-col justify-center">
          <AgingBar buckets={kpis.aging} />
        </div>

        {/* REINCIDÊNCIAS */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm xl:col-span-2 flex flex-col">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="text-lg font-black text-slate-800">Reincidências no Período</h3>
              <p className="text-xs text-slate-500 font-semibold">Clique no veículo para ver detalhes</p>
            </div>
            <div className="relative">
              <FaSearch className="absolute left-3 top-2.5 text-slate-400" />
              <input
                className="w-full md:w-64 pl-9 pr-8 py-2 rounded-xl border border-slate-200 text-sm font-semibold focus:ring-2 focus:ring-blue-200 outline-none"
                value={reincQuery}
                onChange={(e) => setReincQuery(e.target.value)}
                placeholder="Buscar frota..."
              />
              {reincQuery && (
                <button onClick={() => setReincQuery("")} className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"><FaTimes /></button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-xl flex-1">
            <table className="w-full text-left text-sm border-collapse min-w-[700px]">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-3 font-black">Frota</th>
                  <th className="p-3 text-center font-black">Reentradas</th>
                  <th className="p-3 text-center font-black">Entradas Totais</th>
                  <th className="p-3 text-center font-black">Dias Parado</th>
                  <th className="p-3 font-black">Última Entrada</th>
                  <th className="p-3 font-black w-1/3">Preview</th>
                </tr>
              </thead>
              <tbody>
                {reincFiltradas.slice(0, 50).map((r) => (
                  <tr key={r.frota} className="border-b last:border-b-0 hover:bg-blue-50 cursor-pointer transition-colors" onClick={() => abrirDetalheFrota(r.frota)}>
                    <td className="p-3 font-black text-slate-800">{r.frota}</td>
                    <td className="p-3 text-center"><span className="px-2 py-1 rounded bg-rose-100 text-rose-700 text-xs font-black">{r.reentradas}</span></td>
                    <td className="p-3 text-center font-bold text-slate-700">{r.entradas}</td>
                    <td className="p-3 text-center font-black text-amber-600">{r.diasParadoTotal}</td>
                    <td className="p-3 text-[11px] font-bold text-slate-600">{fmtBRDateTime(r.ultimaEntrada)}</td>
                    <td className="p-3 text-[10px] font-semibold text-slate-500 uppercase truncate max-w-[200px]">{(r.descricoesPreview || []).join(" • ") || "—"}</td>
                  </tr>
                ))}
                {(!reincFiltradas.length && !loading) && (
                  <tr><td colSpan={6} className="p-6 text-center text-slate-400 font-bold">Nenhuma reincidência encontrada.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* EXTRAS (Sections com Collapse) */}
      {!compact && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <Section title="Pareto de Setor e Categoria" subtitle="Top 6 ofensores do período selecionado" open={secParetoOpen} onToggle={() => setSecParetoOpen((v) => !v)}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                <div className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-3">Ranking por Setor</div>
                <div className="space-y-2">
                  {(kpis.setores || []).slice(0, 6).map((s) => (
                    <div key={s.setor} className="flex items-center justify-between bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
                      <div className="text-xs font-black text-slate-700">{s.setor}</div>
                      <div className="text-xs font-black text-slate-900">{s.total} <span className="text-[10px] text-slate-400 font-bold ml-1">({s.pct}%)</span></div>
                    </div>
                  ))}
                  {(kpis.setores || []).length === 0 && <div className="text-xs text-slate-400 font-bold">Sem dados.</div>}
                </div>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                <div className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-3">Ranking por Categoria</div>
                <div className="space-y-2">
                  {(kpis.categorias || []).slice(0, 6).map((c) => (
                    <div key={c.categoria} className="flex items-center justify-between bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
                      <div className="text-xs font-black text-slate-700">{c.categoria}</div>
                      <div className="text-xs font-black text-slate-900">{c.total} <span className="text-[10px] text-slate-400 font-bold ml-1">({c.pct}%)</span></div>
                    </div>
                  ))}
                  {(kpis.categorias || []).length === 0 && <div className="text-xs text-slate-400 font-bold">Sem dados.</div>}
                </div>
              </div>
            </div>
          </Section>

          <Section title="TOP 5 Ofensores" subtitle="Veículos com mais dias parados e reentradas" open={secTopsOpen} onToggle={() => setSecTopsOpen((v) => !v)}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <div className="text-[10px] font-black text-slate-500 uppercase tracking-wider p-4 border-b bg-slate-50">Por Dias Parados</div>
                <table className="w-full text-left text-sm border-collapse">
                  <thead className="bg-slate-50 text-[10px] uppercase text-slate-400 border-b">
                    <tr><th className="px-4 py-2 font-black">Frota</th><th className="px-4 py-2 font-black text-center">Dias</th></tr>
                  </thead>
                  <tbody>
                    {topParado.map((r) => (
                      <tr key={r.frota} onClick={() => abrirDetalheFrota(r.frota)} className="border-b last:border-b-0 hover:bg-slate-50 cursor-pointer">
                        <td className="px-4 py-2.5 font-black text-slate-800">{r.frota}</td>
                        <td className="px-4 py-2.5 font-black text-amber-600 text-center">{r.diasParadoTotal}</td>
                      </tr>
                    ))}
                    {topParado.length === 0 && <tr><td colSpan={2} className="px-4 py-4 text-xs text-slate-400 text-center font-bold">Sem dados.</td></tr>}
                  </tbody>
                </table>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <div className="text-[10px] font-black text-slate-500 uppercase tracking-wider p-4 border-b bg-slate-50">Por Reentradas</div>
                <table className="w-full text-left text-sm border-collapse">
                  <thead className="bg-slate-50 text-[10px] uppercase text-slate-400 border-b">
                    <tr><th className="px-4 py-2 font-black">Frota</th><th className="px-4 py-2 font-black text-center">Vezes</th></tr>
                  </thead>
                  <tbody>
                    {topReinc.map((r) => (
                      <tr key={r.frota} onClick={() => abrirDetalheFrota(r.frota)} className="border-b last:border-b-0 hover:bg-slate-50 cursor-pointer">
                        <td className="px-4 py-2.5 font-black text-slate-800">{r.frota}</td>
                        <td className="px-4 py-2.5 font-black text-rose-600 text-center">{r.reentradas}</td>
                      </tr>
                    ))}
                    {topReinc.length === 0 && <tr><td colSpan={2} className="px-4 py-4 text-xs text-slate-400 text-center font-bold">Sem dados.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </Section>

          <Section title="Histórico de GNS" subtitle="Média por Dia (Últimos 18 meses)" open={secSerieOpen} onToggle={() => setSecSerieOpen((v) => !v)} right={<span className="text-[10px] font-bold bg-slate-200 text-slate-700 px-2 py-1 rounded">Geral (Sem filtro)</span>}>
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse min-w-[500px]">
                <thead className="bg-slate-50 text-[10px] uppercase text-slate-500 border-b tracking-wider">
                  <tr><th className="px-4 py-3 font-black">Mês</th><th className="px-4 py-3 text-center font-black">Dias PCM</th><th className="px-4 py-3 text-center font-black">Total GNS</th><th className="px-4 py-3 text-center font-black">Média GNS/Dia</th></tr>
                </thead>
                <tbody>
                  {(serieMensal || []).map((r) => (
                    <tr key={r.mes} className="border-b last:border-b-0 hover:bg-slate-50">
                      <td className="px-4 py-3 font-black text-slate-700">{r.mes}</td>
                      <td className="px-4 py-3 text-center font-semibold text-slate-600">{r.dias_com_pcm}</td>
                      <td className="px-4 py-3 text-center font-semibold text-slate-600">{r.total_gns}</td>
                      <td className="px-4 py-3 text-center"><span className="bg-slate-800 text-white px-3 py-1 rounded-full text-xs font-black shadow-sm">{r.media_gns_dia}</span></td>
                    </tr>
                  ))}
                  {(serieMensal || []).length === 0 && !loading && (
                    <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-400 font-bold">Sem histórico suficiente.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Section>
        </div>
      )}

      {/* Loading Overlay */}
      {loading && (
        <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-[1px] flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl px-6 py-4 shadow-xl border border-slate-200 font-black text-slate-800">
            Atualizando Resumo PCM...
          </div>
        </div>
      )}

      {/* MODAIS */}
      {mostrarExplicacao && (
        <ExplicacaoModal onClose={() => setMostrarExplicacao(false)} />
      )}

      <FrotaDetalheModal
        open={modalOpen}
        onClose={fecharModal}
        frota={modalFrota}
        rows={modalRows}
        periodo={periodoAtual}
      />
    </div>
  );
}
