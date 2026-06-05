import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, LabelList } from "recharts";
import { FaChartLine, FaDownload, FaFilter, FaHeadset } from "react-icons/fa";
import { supabase } from "../../supabase";
import DateRangePopover from "../../components/DateRangePopover";
import { InoveStatCard } from "../../components/InovePage";
import { formatDateBR, SAC_STATUS, statusTone, todayISO } from "./SacCommon";

function startOfMonthISO(iso) {
  const [y, m] = iso.split("-").map(Number);
  return `${y}-${String(m).padStart(2, "0")}-01`;
}

function endOfMonthISO(iso) {
  const [y, m] = iso.split("-").map(Number);
  return new Date(y, m, 0).toISOString().slice(0, 10);
}

function monthLabel(key) {
  const [, month] = key.split("-");
  const labels = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
  return labels[Number(month) - 1] || month;
}

function fmtInt(value) {
  return Number(value || 0).toLocaleString("pt-BR");
}

function countBy(rows, keyFn) {
  const map = new Map();
  rows.forEach((row) => {
    const key = keyFn(row) || "Nao informado";
    map.set(key, (map.get(key) || 0) + 1);
  });
  return Array.from(map.entries())
    .map(([label, total]) => ({ label, total }))
    .sort((a, b) => b.total - a.total);
}

export default function SacResumo() {
  const hoje = todayISO();
  const [filtros, setFiltros] = useState({ dataInicio: startOfMonthISO(hoje), dataFim: endOfMonthISO(hoje), status: "Todos" });
  const [rows, setRows] = useState([]);
  const [evolucao, setEvolucao] = useState([]);
  const [loading, setLoading] = useState(false);

  async function carregar() {
    setLoading(true);
    try {
      let q = supabase
        .from("sac_atendimentos")
        .select("*")
        .gte("data_atendimento", filtros.dataInicio)
        .lte("data_atendimento", filtros.dataFim)
        .order("data_atendimento", { ascending: false });
      if (filtros.status !== "Todos") q = q.eq("status", filtros.status);
      const { data, error } = await q;
      if (error) throw error;
      setRows(data || []);

      const ano = filtros.dataInicio.slice(0, 4);
      const { data: anoRows, error: anoError } = await supabase
        .from("sac_atendimentos")
        .select("id, status, data_atendimento")
        .gte("data_atendimento", `${ano}-01-01`)
        .lte("data_atendimento", `${ano}-12-31`);
      if (anoError) throw anoError;
      setEvolucao(anoRows || []);
    } catch (error) {
      console.error(error);
      alert(`Erro ao carregar resumo SAC: ${error?.message || error}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregar();
  }, [filtros.dataInicio, filtros.dataFim, filtros.status]);

  const cards = useMemo(() => {
    const total = rows.length;
    const emTratativa = rows.filter((r) => r.status === "Em tratativa").length;
    const aguardandoRetorno = rows.filter((r) => r.status === "Aguardando resposta ao cliente").length;
    const concluidos = rows.filter((r) => r.status === "Concluido").length;
    const cancelados = rows.filter((r) => r.status === "Cancelado").length;

    // Tempo médio de resposta ao cliente:
    // diferença entre created_at e concluido_em, considerando só os SACs que
    // passaram por tratativa (tinham status Pendente / Em tratativa antes de concluir).
    const concluidosComTratativa = rows.filter(
      (r) => r.status === "Concluido" && r.tratativa_id && r.concluido_em && r.created_at
    );
    let tempoMedioMs = null;
    if (concluidosComTratativa.length) {
      const soma = concluidosComTratativa.reduce((acc, r) => {
        const ini = new Date(r.created_at).getTime();
        const fim = new Date(r.concluido_em).getTime();
        return acc + Math.max(0, fim - ini);
      }, 0);
      tempoMedioMs = soma / concluidosComTratativa.length;
    }
    let tempoLabel = "—";
    if (tempoMedioMs !== null) {
      const horas = tempoMedioMs / (1000 * 60 * 60);
      if (horas >= 24) tempoLabel = `${(horas / 24).toFixed(1)}d`;
      else if (horas >= 1) tempoLabel = `${horas.toFixed(1)}h`;
      else tempoLabel = `${Math.round(tempoMedioMs / 60000)}min`;
    }

    return [
      ["Atendimentos", total],
      ["Em tratativa", emTratativa],
      ["Aguardando retorno", aguardandoRetorno],
      ["Concluidos", concluidos],
      ["Cancelados", cancelados],
      [`Tempo medio de resposta (${concluidosComTratativa.length})`, tempoLabel],
    ];
  }, [rows]);

  const chartData = useMemo(() => {
    const ano = filtros.dataInicio.slice(0, 4);
    const base = Array.from({ length: 12 }, (_, i) => {
      const key = `${ano}-${String(i + 1).padStart(2, "0")}`;
      return { mes: monthLabel(key), total: 0, tratativa: 0, concluido: 0 };
    });
    evolucao.forEach((row) => {
      const date = String(row.data_atendimento || "");
      const index = Number(date.slice(5, 7)) - 1;
      if (index < 0 || index > 11) return;
      base[index].total += 1;
      if (row.status === "Em tratativa") base[index].tratativa += 1;
      if (row.status === "Concluido") base[index].concluido += 1;
    });
    return base;
  }, [evolucao, filtros.dataInicio]);

  const porOrigem = useMemo(() => countBy(rows, (r) => r.origem), [rows]);
  const porMotivo = useMemo(() => countBy(rows, (r) => r.grupo_motivo), [rows]);

  function baixarExcel() {
    const wb = XLSX.utils.book_new();
    const data = rows.map((row) => ({
      protocolo: row.protocolo,
      status: row.status,
      data_atendimento: row.data_atendimento,
      hora_atendimento: row.hora_atendimento,
      origem: row.origem,
      atendente: row.atendente_nome || row.atendente_login,
      cliente: row.cliente_nome,
      telefone: row.cliente_telefone,
      veiculo: row.carro_prefixo,
      linha: row.linha,
      operador_chapa: row.operador_chapa,
      operador_nome: row.operador_nome,
      grupo_motivo: row.grupo_motivo,
      subgrupo_motivo: row.subgrupo_motivo,
      data_ocorrencia: row.data_ocorrencia,
      hora_ocorrencia: row.hora_ocorrencia,
      acao_tomada: row.acao_tomada,
      tratativa_id: row.tratativa_id,
      detalhamento: row.detalhamento,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), "SAC");
    XLSX.writeFile(wb, `sac_resumo_${filtros.dataInicio}_a_${filtros.dataFim}.xlsx`);
  }

  return (
    <div className="min-h-screen space-y-5 bg-slate-50 p-4 text-slate-800 md:p-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.24em] text-blue-600">SAC</div>
            <h1 className="mt-3 flex items-center gap-3 text-3xl font-black text-slate-900">
              <span className="rounded-2xl bg-blue-50 p-3 text-blue-600"><FaHeadset /></span>
              Resumo de atendimentos
            </h1>
            <p className="mt-2 text-sm text-slate-600">Report diario, evolução mensal do ano e Excel detalhado.</p>
          </div>
          <button type="button" disabled={loading || rows.length === 0} onClick={baixarExcel} className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-black text-white shadow-sm hover:bg-emerald-700 disabled:bg-slate-400">
            <FaDownload /> Baixar Excel
          </button>
        </div>
      </div>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2 text-sm font-black text-slate-800"><FaFilter /> Filtros</div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <DateRangePopover
            from={filtros.dataInicio}
            to={filtros.dataFim}
            placeholder="Selecionar periodo"
            onChange={({ from, to }) => setFiltros((current) => ({ ...current, dataInicio: from, dataFim: to }))}
            onClear={() => setFiltros((current) => ({ ...current, dataInicio: "", dataFim: "" }))}
          />
          <select value={filtros.status} onChange={(e) => setFiltros({ ...filtros, status: e.target.value })} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-bold outline-none focus:border-blue-400">
            <option value="Todos">Todos os status</option>
            {SAC_STATUS.map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {cards.map(([label, value], index) => (
          <InoveStatCard
            key={label}
            title={label}
            value={fmtInt(value)}
            tone={index === 1 ? "amber" : index === 2 ? "emerald" : index === 3 ? "rose" : "blue"}
          />
        ))}
      </div>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2 text-sm font-black text-slate-800"><FaChartLine /> Evolução mensal do ano</div>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 24, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="mes" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="total" name="Total" stroke="#2563eb" strokeWidth={3}>
                <LabelList dataKey="total" position="top" formatter={(v) => (v ? fmtInt(v) : "")} />
              </Line>
              <Line type="monotone" dataKey="tratativa" name="Em tratativa" stroke="#d97706" strokeWidth={3} />
              <Line type="monotone" dataKey="concluido" name="Concluidos" stroke="#059669" strokeWidth={3} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Ranking title="Origem do atendimento" rows={porOrigem} />
        <Ranking title="Grupo de motivos" rows={porMotivo} />
      </div>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-black text-slate-900">Detalhado</h2>
        <div className="mt-4 overflow-hidden rounded-3xl border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-black uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Protocolo</th>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Origem</th>
                <th className="px-4 py-3">Motivo</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-3 font-black text-blue-700">{row.protocolo}</td>
                  <td className="px-4 py-3 font-semibold">{formatDateBR(row.data_atendimento)}</td>
                  <td className="px-4 py-3 font-semibold">{row.cliente_nome || "-"}</td>
                  <td className="px-4 py-3 font-semibold">{row.origem}</td>
                  <td className="px-4 py-3 font-semibold">{row.grupo_motivo}</td>
                  <td className="px-4 py-3"><span className={`rounded-full border px-3 py-1 text-xs font-black ${statusTone(row.status)}`}>{row.status}</span></td>
                </tr>
              ))}
              {rows.length === 0 && !loading ? (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-sm font-bold text-slate-400">Sem atendimentos no periodo.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Ranking({ title, rows }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-black text-slate-900">{title}</h2>
      <div className="mt-4 space-y-3">
        {rows.slice(0, 8).map((row) => (
          <div key={row.label} className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
            <span className="text-sm font-bold text-slate-700">{row.label}</span>
            <span className="text-sm font-black text-blue-700">{fmtInt(row.total)}</span>
          </div>
        ))}
        {rows.length === 0 ? <div className="text-sm font-bold text-slate-400">Sem dados.</div> : null}
      </div>
    </section>
  );
}
