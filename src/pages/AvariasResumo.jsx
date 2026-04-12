// src/pages/AvariasResumo.jsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LabelList
} from "recharts";
import {
  FaSearch,
  FaTimes,
  FaCar,
  FaCalendarAlt,
  FaExclamationTriangle,
  FaChartLine,
  FaRedo,
  FaFilter,
  FaUserTie,
  FaMoneyBillWave,
  FaInfoCircle,
  FaBan,
  FaCheckCircle,
  FaTools,
  FaClock,
  FaBus,
  FaRoad,
  FaDownload
} from "react-icons/fa";

/* =========================
   HELPERS (Datas e Numéricos)
========================= */

function toISODate(d) {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
}

function startOfMonthISO(iso) {
  const [y, m] = iso.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  return toISODate(d);
}

function endOfMonthISO(iso) {
  const [y, m] = iso.split("-").map(Number);
  const d = new Date(y, m, 0);
  return toISODate(d);
}

function moneyBRL(v) {
  const n = Number(v || 0);
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function compactBRL(v) {
  const n = Number(v || 0);
  if (n === 0) return "";
  if (n >= 1000000) return `R$ ${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `R$ ${(n / 1000).toFixed(1)}k`;
  return `R$ ${n.toFixed(0)}`;
}

function fmtInt(v) {
  return Math.round(Number(v || 0)).toLocaleString("pt-BR");
}

function safeLower(v) {
  return String(v || "").trim().toLowerCase();
}

function normalizeOrigem(row) {
  const raw = row?.origem || row?.origem_cobranca || "";
  const s = safeLower(raw);
  if (!s) return "";
  if (s === "interno" || s === "interna") return "Interno";
  if (s === "externo" || s === "externa") return "Externo";
  return String(raw);
}

function normalizeStatusCobranca(row) {
  const s = safeLower(row?.status_cobranca);
  if (!s) return "Pendente";
  if (s === "cobrada") return "Cobrada";
  if (s === "cancelada") return "Cancelada";
  return row.status_cobranca;
}

function toMonthKeyFromDataAvaria(dateRaw) {
  if (!dateRaw) return null;
  const d = new Date(dateRaw.includes("T") ? dateRaw : `${dateRaw}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function monthLabel(ym) {
  const [y, m] = String(ym || "").split("-");
  if (!y || !m) return ym;
  const map = {
    "01": "JAN", "02": "FEV", "03": "MAR", "04": "ABR",
    "05": "MAI", "06": "JUN", "07": "JUL", "08": "AGO",
    "09": "SET", "10": "OUT", "11": "NOV", "12": "DEZ",
  };
  return `${map[m] || m}/${String(y).slice(2)}`;
}

function exportarCSV(dados, nomeArquivo) {
  if (!dados?.length) {
    alert("Não há dados para exportar.");
    return;
  }
  
  const cabecalho = ["ID", "Data Avaria", "Veículo (Prefixo)", "Motorista/Responsável", "Origem", "Status Cobrança", "Valor Orçado", "Valor Cobrado"];
  
  const linhas = dados.map((row) => {
    const dataFmt = row.dataAvaria ? new Date(row.dataAvaria.includes("T") ? row.dataAvaria : `${row.dataAvaria}T00:00:00`).toLocaleDateString("pt-BR") : "";
    const motoristaLimpo = String(row.motoristaId || "").includes(' - ') ? String(row.motoristaId).split(' - ')[1].trim() : String(row.motoristaId || "");
    
    return [
      row.id,
      dataFmt,
      row.prefixo || "",
      motoristaLimpo,
      normalizeOrigem(row),
      normalizeStatusCobranca(row),
      Number(row.valor_total_orcamento || 0).toFixed(2).replace(".", ","),
      Number(row.valor_cobrado || 0).toFixed(2).replace(".", ",")
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(";");
  });

  const csv = [cabecalho.join(";"), ...linhas].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${nomeArquivo}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/* =========================
   COMPONENTES UI GERAIS
========================= */

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
            {sub && <p className="text-[11px] mt-1 font-bold opacity-80">{sub}</p>}
          </div>
        </div>
        <div className="text-xl mt-1 opacity-80">{icon}</div>
      </div>
    </div>
  );
}

/* =========================
   MODAL DE EXPLICAÇÃO
========================= */

function ExplicacaoModal({ onClose }) {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm z-[70] animate-in fade-in duration-200 p-4">
      <div className="bg-white p-6 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center mb-4 border-b pb-4 shrink-0">
          <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
            <FaInfoCircle className="text-blue-600" /> Entender Cálculos (Avarias)
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-rose-500 hover:bg-rose-50 p-2 rounded-xl transition">
            <FaTimes size={20} />
          </button>
        </div>

        <div className="overflow-y-auto pr-2 space-y-5 text-sm text-slate-700">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <h3 className="font-black text-slate-800 mb-2 flex items-center gap-2"><FaFilter className="text-slate-500"/> Base de Dados</h3>
            <p>O painel contabiliza <strong>apenas as avarias com status "Aprovado"</strong>. Avarias rejeitadas ou em análise não entram na soma financeira nem nas contagens do ranking.</p>
          </div>

          <div className="bg-rose-50 p-4 rounded-xl border border-rose-200">
            <h3 className="font-black text-rose-900 mb-2 flex items-center gap-2"><FaCar className="text-rose-600"/> Avarias Internas vs Externas</h3>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Internas (Cobrança Motoristas):</strong> São danos causados na garagem ou em situações de culpabilidade direta do colaborador interno da empresa. O alvo da cobrança é o funcionário.</li>
              <li><strong>Externas (Terceiros):</strong> São danos causados por terceiros no trânsito (acidentes de operação externa). A cobrança é direcionada ao seguro ou ao terceiro envolvido.</li>
            </ul>
          </div>

          <div className="bg-blue-50 p-4 rounded-xl border border-blue-200">
            <h3 className="font-black text-blue-900 mb-2 flex items-center gap-2"><FaMoneyBillWave className="text-blue-600"/> Orçado vs. Cobrado</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Orçado:</strong> É o valor total orçado da manutenção da avaria (peças + mão de obra).</li>
              <li><strong>Cobrado:</strong> É o valor que de fato foi lançado para desconto ou cobrança do culpado.</li>
            </ul>
          </div>

          <div className="bg-amber-50 p-4 rounded-xl border border-amber-200">
            <h3 className="font-black text-amber-900 mb-2 flex items-center gap-2"><FaChartLine className="text-amber-600"/> Gráfico de Eixo Duplo</h3>
            <p>No gráfico de evolução mensal, as barras de "Orçado" e "Cobrado" (Reais) usam a escala numérica da <strong>direita</strong>. Já a barra de "Quantidade" (Unidades) usa a escala numérica da <strong>esquerda</strong>. Isso impede que os valores financeiros esmaguem as barras de quantidade visualmente.</p>
          </div>
        </div>

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
   PAGE: AvariasResumo
========================= */

export default function AvariasResumo() {
  const hojeISO = useMemo(() => toISODate(new Date()), []);
  const mesAtualIni = useMemo(() => startOfMonthISO(hojeISO), [hojeISO]);
  const mesAtualFim = useMemo(() => endOfMonthISO(hojeISO), [hojeISO]);

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [errMsg, setErrMsg] = useState("");
  const [mostrarExplicacao, setMostrarExplicacao] = useState(false);

  const [dataInicio, setDataInicio] = useState(mesAtualIni);
  const [dataFim, setDataFim] = useState(mesAtualFim);
  const [origemFiltro, setOrigemFiltro] = useState("");

  const carregar = async () => {
    setLoading(true);
    setErrMsg("");

    let query = supabase
      .from("avarias")
      .select(
        "id, status, status_cobranca, valor_total_orcamento, valor_cobrado, origem, origem_cobranca, dataAvaria, created_at, prefixo, motoristaId"
      )
      .eq("status", "Aprovado")
      .order("created_at", { ascending: false });

    if (dataInicio) query = query.gte("dataAvaria", dataInicio);
    if (dataFim) query = query.lte("dataAvaria", `${dataFim}T23:59:59`);

    if (origemFiltro) {
      query = query.or(`origem.ilike.${origemFiltro},origem_cobranca.ilike.${origemFiltro}`);
    }

    const { data, error } = await query;

    if (error) {
      console.error("AvariasResumo: erro ao carregar:", error);
      setRows([]);
      setErrMsg(error.message || "Erro ao carregar dados.");
    } else {
      setRows(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataInicio, dataFim, origemFiltro]);

  const kpis = useMemo(() => {
    const base = rows;

    const interno = base.filter((r) => normalizeOrigem(r) === "Interno");
    const externo = base.filter((r) => normalizeOrigem(r) === "Externo");

    const sumOrcado = (arr) => arr.reduce((s, r) => s + Number(r.valor_total_orcamento || 0), 0);
    const sumCobrado = (arr) => arr.reduce((s, r) => s + Number(r.valor_cobrado || 0), 0);

    const pendentes = base.filter((r) => normalizeStatusCobranca(r) === "Pendente");
    const cobradas = base.filter((r) => normalizeStatusCobranca(r) === "Cobrada");
    const canceladas = base.filter((r) => normalizeStatusCobranca(r) === "Cancelada");

    return {
      totalQtde: base.length,
      totalOrcado: sumOrcado(base),
      totalCobrado: sumCobrado(base),

      internoQtde: interno.length,
      internoOrcado: sumOrcado(interno),
      internoCobrado: sumCobrado(interno),

      externoQtde: externo.length,
      externoOrcado: sumOrcado(externo),
      externoCobrado: sumCobrado(externo),

      pendQtde: pendentes.length,
      pendOrcado: sumOrcado(pendentes),

      cobQtde: cobradas.length,
      cobCobrado: sumCobrado(cobradas),

      cancQtde: canceladas.length,
      cancOrcado: sumOrcado(canceladas),
      cancCobrado: sumCobrado(canceladas),
    };
  }, [rows]);

  const chartData = useMemo(() => {
    const map = new Map();

    for (const r of rows) {
      const key = toMonthKeyFromDataAvaria(r.dataAvaria);
      if (!key) continue;

      if (!map.has(key)) map.set(key, { mes: key, qtde: 0, orcado: 0, cobrado: 0 });

      const item = map.get(key);
      item.qtde += 1;
      item.orcado += Number(r.valor_total_orcamento || 0);
      item.cobrado += Number(r.valor_cobrado || 0);
    }

    return Array.from(map.values())
      .sort((a, b) => (a.mes > b.mes ? 1 : -1))
      .map((x) => ({ ...x, mesLabel: monthLabel(x.mes) }));
  }, [rows]);

  const { topVeiculos, topMotoristas } = useMemo(() => {
    const mapVeic = new Map();
    const mapMot = new Map();

    rows.forEach(r => {
      const v = String(r.prefixo || "").trim();
      if (v && v !== "-") {
        if (!mapVeic.has(v)) mapVeic.set(v, { nome: v, qtd: 0, orcado: 0, cobrado: 0 });
        const itemV = mapVeic.get(v);
        itemV.qtd += 1;
        itemV.orcado += Number(r.valor_total_orcamento || 0);
        itemV.cobrado += Number(r.valor_cobrado || 0);
      }

      const mRaw = String(r.motoristaId || "").trim();
      if (mRaw && mRaw !== "-") {
        const name = mRaw.includes(' - ') ? mRaw.split(' - ')[1].trim() : mRaw;
        
        if (!mapMot.has(name)) mapMot.set(name, { nome: name, qtd: 0, orcado: 0, cobrado: 0 });
        const itemM = mapMot.get(name);
        itemM.qtd += 1;
        itemM.orcado += Number(r.valor_total_orcamento || 0);
        itemM.cobrado += Number(r.valor_cobrado || 0);
      }
    });

    const sortFn = (a, b) => b.qtd - a.qtd || b.orcado - a.orcado;

    return {
      topVeiculos: Array.from(mapVeic.values()).sort(sortFn).slice(0, 10),
      topMotoristas: Array.from(mapMot.values()).sort(sortFn).slice(0, 10)
    };
  }, [rows]);

  return (
    <div className="min-h-screen bg-slate-50 p-4 space-y-6">
      
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 md:p-5">
        <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-50 text-rose-700 text-xs font-black border border-rose-200">
              <FaCar /> Gestão de Danos e Custos
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-slate-800 mt-3 flex items-center gap-3">
              PAINEL DE AVARIAS
            </h1>
            <p className="text-sm text-slate-500 mt-1 flex items-center gap-2 font-semibold">
              <FaCalendarAlt /> Visão analítica de avarias aprovadas, cobranças e reincidências.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => exportarCSV(rows, `Avarias_${dataInicio}_a_${dataFim}`)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-500 transition shadow-sm"
              title="Baixar para Excel"
            >
              <FaDownload /> Exportar Dados
            </button>

            <button
              onClick={() => setMostrarExplicacao(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-100 text-blue-800 font-bold hover:bg-blue-200 transition"
              title="Entender Cálculos"
            >
              <FaInfoCircle /> Entender Cálculos
            </button>

            <button
              onClick={carregar}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-800 bg-slate-800 text-white font-black hover:bg-slate-700 transition"
              title="Recarregar dados"
            >
              <FaRedo /> Atualizar
            </button>
          </div>
        </div>

        <div className="mt-5 pt-5 border-t flex flex-col md:flex-row gap-4 items-start md:items-end">
          <div className="flex flex-col">
            <label className="text-[10px] font-black text-slate-500 uppercase mb-1">Origem do Dano</label>
            <select
              className="border border-slate-300 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-blue-200 outline-none"
              value={origemFiltro}
              onChange={(e) => setOrigemFiltro(e.target.value)}
            >
              <option value="">Todas as origens</option>
              <option value="Interno">Avaria Interna (Garagem)</option>
              <option value="Externo">Avaria Externa (Operação)</option>
            </select>
          </div>

          <div className="flex flex-col">
            <label className="text-[10px] font-black text-slate-500 uppercase mb-1">Período (Data Avaria)</label>
            <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200">
              <input
                type="date"
                className="bg-transparent text-sm font-black text-slate-700 outline-none px-2"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
              />
              <span className="text-slate-400 font-bold">até</span>
              <input
                type="date"
                className="bg-transparent text-sm font-black text-slate-700 outline-none px-2"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
              />
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => {
                setDataInicio(mesAtualIni);
                setDataFim(mesAtualFim);
                setOrigemFiltro("");
              }}
              className="px-4 py-2.5 rounded-xl font-black text-sm bg-blue-50 text-blue-700 hover:bg-blue-100 transition shadow-sm border border-blue-200"
            >
              Mês Atual
            </button>

            <button
              onClick={() => {
                setOrigemFiltro("");
                setDataInicio("");
                setDataFim("");
              }}
              className="px-4 py-2.5 rounded-xl font-black text-sm bg-slate-100 text-slate-700 hover:bg-slate-200 transition"
            >
              Limpar filtros
            </button>
          </div>
        </div>

        {errMsg && (
          <div className="mt-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-3 text-sm font-bold flex items-center gap-2">
            <FaExclamationTriangle /> {errMsg}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <CardKPI 
          title="Total de Avarias" 
          value={loading ? "-" : fmtInt(kpis.totalQtde)} 
          sub={loading ? "" : `Orçado: ${moneyBRL(kpis.totalOrcado)}`} 
          icon={<FaTools />} 
          tone="slate" 
        />
        <CardKPI 
          title="Cobranças Pendentes" 
          value={loading ? "-" : fmtInt(kpis.pendQtde)} 
          sub={loading ? "" : `Custo Assumido Temp: ${moneyBRL(kpis.pendOrcado)}`} 
          icon={<FaClock />} 
          tone="amber" 
        />
        <CardKPI 
          title="Avarias Cobradas" 
          value={loading ? "-" : fmtInt(kpis.cobQtde)} 
          sub={loading ? "" : `Valor Recuperado: ${moneyBRL(kpis.cobCobrado)}`} 
          icon={<FaCheckCircle />} 
          tone="emerald" 
        />
        <CardKPI 
          title="Avarias Canceladas" 
          value={loading ? "-" : fmtInt(kpis.cancQtde)} 
          sub={loading ? "" : `Prejuízo Absolvido: ${moneyBRL(kpis.cancOrcado)}`} 
          icon={<FaBan />} 
          tone="rose" 
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Avarias Internas <span className="text-rose-500">(Cobrança Motoristas)</span></p>
            <p className="text-3xl font-black text-slate-800">{fmtInt(kpis.internoQtde)} <span className="text-sm font-bold text-slate-400">veículos</span></p>
            <p className="text-sm text-slate-600 font-bold mt-1">Custo: <span className="text-rose-600">{moneyBRL(kpis.internoOrcado)}</span></p>
          </div>
          <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-400">
            <FaBus size={20} />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Avarias Externas <span className="text-blue-500">(Terceiros)</span></p>
            <p className="text-3xl font-black text-slate-800">{fmtInt(kpis.externoQtde)} <span className="text-sm font-bold text-slate-400">veículos</span></p>
            <p className="text-sm text-slate-600 font-bold mt-1">Custo: <span className="text-rose-600">{moneyBRL(kpis.externoOrcado)}</span></p>
          </div>
          <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-400">
            <FaRoad size={20} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm xl:col-span-3">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-black text-slate-800">Evolução Mensal de Avarias e Custos</h3>
              <p className="text-xs text-slate-500 font-semibold">Quantidade (Eixo Esq.) vs Valores Financeiros (Eixo Dir.)</p>
            </div>
          </div>

          {!loading && rows.length === 0 ? (
            <div className="h-72 flex items-center justify-center text-sm font-bold text-slate-400">
              Nenhum dado encontrado para o período.
            </div>
          ) : (
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 25, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="mesLabel" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 11, fontWeight: "bold" }} dy={10} />
                  
                  <YAxis yAxisId="left" orientation="left" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 11 }} />
                  <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 11 }} tickFormatter={(val) => `R$ ${fmtInt(val)}`} />
                  
                  <Tooltip
                    cursor={{ fill: '#f8fafc' }}
                    formatter={(value, name) => {
                      if (name === "qtde") return [value, "Quantidade"];
                      if (name === "orcado") return [moneyBRL(value), "Valor Orçado"];
                      if (name === "cobrado") return [moneyBRL(value), "Valor Cobrado"];
                      return [value, name];
                    }}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '12px', fontWeight: 'bold' }} />
                  
                  <Bar yAxisId="left" dataKey="qtde" name="Quantidade" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={30}>
                    <LabelList dataKey="qtde" position="top" style={{ fill: "#3b82f6", fontSize: 11, fontWeight: "bold" }} />
                  </Bar>
                  
                  <Bar yAxisId="right" dataKey="orcado" name="Valor Orçado" fill="#f59e0b" radius={[4, 4, 0, 0]} barSize={30}>
                    <LabelList dataKey="orcado" position="top" formatter={compactBRL} style={{ fill: "#f59e0b", fontSize: 10, fontWeight: "bold" }} />
                  </Bar>
                  
                  <Bar yAxisId="right" dataKey="cobrado" name="Valor Cobrado" fill="#10b981" radius={[4, 4, 0, 0]} barSize={30}>
                    <LabelList dataKey="cobrado" position="top" formatter={compactBRL} style={{ fill: "#10b981", fontSize: 10, fontWeight: "bold" }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm xl:col-span-1">
          <h3 className="text-base font-black text-slate-800 flex items-center gap-2 mb-4">
            <FaBus className="text-slate-400" /> Top 10 Veículos
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-3 font-black">Veículo</th>
                  <th className="p-3 text-center font-black">Qtd</th>
                  <th className="p-3 text-right font-black">R$ Orçado</th>
                </tr>
              </thead>
              <tbody>
                {topVeiculos.map((v, i) => (
                  <tr key={v.nome} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                    <td className="p-3 font-black text-slate-800">
                      <span className="text-slate-400 mr-2">#{i+1}</span>{v.nome}
                    </td>
                    <td className="p-3 text-center font-bold text-rose-600">{v.qtd}</td>
                    <td className="p-3 text-right font-bold text-slate-700">{moneyBRL(v.orcado)}</td>
                  </tr>
                ))}
                {topVeiculos.length === 0 && !loading && (
                  <tr><td colSpan={3} className="p-4 text-center text-slate-400 font-bold">Sem dados</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm xl:col-span-2">
          <h3 className="text-base font-black text-slate-800 flex items-center gap-2 mb-4">
            <FaUserTie className="text-slate-400" /> Top 10 Motoristas (Culpabilidade)
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse min-w-[500px]">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-3 font-black">Motorista / Responsável</th>
                  <th className="p-3 text-center font-black">Eventos</th>
                  <th className="p-3 text-right font-black">Custo Total (Orçado)</th>
                  <th className="p-3 text-right font-black">Descontado (Cobrado)</th>
                </tr>
              </thead>
              <tbody>
                {topMotoristas.map((m, i) => (
                  <tr key={m.nome} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                    <td className="p-3 font-black text-slate-800 truncate max-w-[300px]" title={m.nome}>
                      <span className="text-slate-400 mr-2">#{i+1}</span>{m.nome}
                    </td>
                    <td className="p-3 text-center font-bold text-rose-600">{m.qtd}</td>
                    <td className="p-3 text-right font-bold text-slate-700">{moneyBRL(m.orcado)}</td>
                    <td className="p-3 text-right font-bold text-emerald-600">{moneyBRL(m.cobrado)}</td>
                  </tr>
                ))}
                {topMotoristas.length === 0 && !loading && (
                  <tr><td colSpan={4} className="p-4 text-center text-slate-400 font-bold">Sem dados</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {loading && (
        <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-[1px] flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl px-6 py-4 shadow-xl border border-slate-200 font-black text-slate-800">
            Carregando Avarias...
          </div>
        </div>
      )}

      {mostrarExplicacao && (
        <ExplicacaoModal onClose={() => setMostrarExplicacao(false)} />
      )}

    </div>
  );
}
