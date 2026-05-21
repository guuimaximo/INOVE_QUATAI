import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../supabase";
import * as XLSX from "xlsx";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LabelList,
} from "recharts";
import {
  FaClipboardList,
  FaDownload,
  FaFilter,
  FaSearch,
  FaUsers,
  FaExclamationTriangle,
  FaRoad,
  FaTasks,
  FaClock,
  FaCheckCircle,
  FaFolderOpen,
  FaExclamationCircle,
  FaInfoCircle,
  FaTimes,
  FaRedo,
  FaCalendarAlt,
  FaChartLine,
  FaTable,
  FaUserTie,
  FaLayerGroup,
} from "react-icons/fa";

/* =========================
   HELPERS
========================= */

function toISODateOnly(d) {
  if (!d) return "";
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return "";
  return new Date(dt.getTime() - dt.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
}

function startOfMonthISO(iso) {
  const [y, m] = iso.split("-").map(Number);
  return toISODateOnly(new Date(y, m - 1, 1));
}

function endOfMonthISO(iso) {
  const [y, m] = iso.split("-").map(Number);
  return toISODateOnly(new Date(y, m, 0));
}

function startOfYearISO(year) {
  return `${year}-01-01`;
}

function startOfNextYearISO(year) {
  return `${Number(year) + 1}-01-01`;
}

function addDays(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + days);
  return toISODateOnly(d);
}

function normStr(v) {
  return String(v ?? "").trim();
}

function safeLower(v) {
  return normStr(v).toLowerCase();
}

function ilikeContains(hay, needle) {
  return safeLower(hay).includes(safeLower(needle));
}

function fmtInt(v) {
  return Math.round(Number(v || 0)).toLocaleString("pt-BR");
}

function fmtChartLabel(v) {
  const n = Number(v || 0);
  return n > 0 ? fmtInt(n) : "";
}

function formatDateBR(v) {
  if (!v) return "—";
  const txt = String(v).trim();
  const date = txt.includes("T") ? txt.split("T")[0] : txt.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const [y, m, d] = date.split("-");
    return `${d}/${m}/${y}`;
  }
  return txt;
}

function monthKeyFromDate(v) {
  if (!v) return null;
  const d = new Date(String(v).includes("T") ? v : `${v}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(ym) {
  const [y, m] = String(ym || "").split("-");
  const map = {
    "01": "JAN",
    "02": "FEV",
    "03": "MAR",
    "04": "ABR",
    "05": "MAI",
    "06": "JUN",
    "07": "JUL",
    "08": "AGO",
    "09": "SET",
    "10": "OUT",
    "11": "NOV",
    "12": "DEZ",
  };
  return `${map[m] || m}/${String(y).slice(2)}`;
}

function countBy(arr, keyFn) {
  const m = new Map();
  for (const it of arr) {
    const k = keyFn(it) || "Não informado";
    m.set(k, (m.get(k) || 0) + 1);
  }
  return m;
}

function sortMapDesc(m) {
  return [...m.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]), "pt-BR"));
}

function normalizePrioridade(v) {
  const raw = normStr(v);
  if (!raw) return "Sem prioridade";

  const key = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();

  if (key.includes("GRAV")) return "Gravíssima";
  if (key.includes("CRIT")) return "Crítica";
  if (key.includes("URG")) return "Urgente";
  if (key.includes("ALT")) return "Alta";
  if (key.includes("MED")) return "Média";
  if (key.includes("BAIX")) return "Baixa";

  return raw;
}

function prioridadeSortValue(v) {
  const ordem = {
    "Gravíssima": 1,
    "Crítica": 2,
    "Urgente": 3,
    Alta: 4,
    Média: 5,
    Baixa: 6,
    "Sem prioridade": 99,
  };
  return ordem[v] ?? 50;
}

function filtrarPorPrioridades(list, prioridades) {
  if (!prioridades?.length) return list;
  const selected = new Set(prioridades);
  return list.filter((t) => selected.has(normalizePrioridade(t.prioridade)));
}

function isPendente(status) {
  const s = safeLower(status);
  return s.includes("pend") || s.includes("abert");
}

function isConcluida(status) {
  const s = safeLower(status);
  return s.includes("conclu") || s.includes("resolvid") || s.includes("finaliz");
}

function isAtrasada(row) {
  if (!isPendente(row?.status)) return false;
  if (!row?.created_at) return false;
  const d = new Date(row.created_at);
  if (Number.isNaN(d.getTime())) return false;
  const limite = new Date();
  limite.setDate(limite.getDate() - 10);
  return d < limite;
}

function motoristaKey(t) {
  const chapa = normStr(t?.motorista_chapa || t?.motorista_id);
  const nome = normStr(t?.motorista_nome);
  return `${chapa}|${nome}`;
}

function motoristaLabel(key) {
  const [chapa, nome] = String(key || "").split("|");
  if (chapa && nome) return `${chapa} - ${nome}`;
  return nome || chapa || "Não informado";
}

function statusTone(status) {
  if (isConcluida(status)) return "emerald";
  if (isPendente(status)) return "amber";
  return "slate";
}

function exportarCSV(dados, nomeArquivo) {
  if (!dados?.length) {
    alert("Não há dados para exportar.");
    return;
  }

  const cols = Object.keys(dados[0]).filter((k) => typeof dados[0][k] !== "object");
  const csv = [
    cols.join(";"),
    ...dados.map((row) =>
      cols.map((col) => `"${String(row[col] ?? "").replace(/"/g, '""')}"`).join(";")
    ),
  ].join("\n");

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
   COMPONENTES UI
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
    <div className={`rounded-2xl border bg-gradient-to-br ${tones[tone]} p-3.5 shadow-sm ${className}`}>
      <div className="flex items-start justify-between gap-3 h-full">
        <div className="flex flex-col justify-between h-full">
          <p className="text-xs font-black uppercase tracking-wider opacity-80">{title}</p>
          <div>
            <p className="text-xl md:text-3xl font-black mt-2 text-slate-800">{value}</p>
            {sub && <p className="text-[11px] mt-1 font-bold opacity-80">{sub}</p>}
          </div>
        </div>
        <div className="text-xl mt-1 opacity-80">{icon}</div>
      </div>
    </div>
  );
}

function Badge({ children, tone = "slate" }) {
  const tones = {
    slate: "bg-slate-100 text-slate-700 border-slate-200",
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    rose: "bg-rose-50 text-rose-700 border-rose-200",
    violet: "bg-violet-50 text-violet-700 border-violet-200",
    indigo: "bg-indigo-50 text-indigo-700 border-indigo-200",
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-1 text-xs border rounded-lg font-black ${tones[tone] || tones.slate}`}>
      {children}
    </span>
  );
}

function TabButton({ active, onClick, icon, children }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-black transition ${
        active
          ? "bg-slate-800 text-white border-slate-800 shadow"
          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

function RankingTable({ title, icon, rows, columns, emptyText = "Sem dados", onRowClick }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
      <h3 className="text-base font-black text-slate-800 flex items-center gap-2 mb-4">
        {icon} {title}
      </h3>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm border-collapse">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[10px]">
            <tr>
              {columns.map((c) => (
                <th key={c.key} className={`p-3 font-black ${c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : ""}`}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.map((row, idx) => (
              <tr
                key={row.key || row.nome || idx}
                onClick={() => onRowClick?.(row)}
                className={`border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors ${onRowClick ? "cursor-pointer" : ""}`}
              >
                {columns.map((c) => (
                  <td key={c.key} className={`p-3 ${c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : ""}`}>
                    {c.render ? c.render(row, idx) : row[c.key]}
                  </td>
                ))}
              </tr>
            ))}

            {rows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="p-6 text-center text-slate-400 font-bold">
                  {emptyText}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* =========================
   MODAIS
========================= */

function ExplicacaoModal({ onClose }) {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm z-[70] animate-in fade-in duration-200 p-4">
      <div className="bg-white p-6 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center mb-4 border-b pb-4 shrink-0">
          <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
            <FaInfoCircle className="text-blue-600" /> Entender Cálculos (Tratativas)
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-rose-500 hover:bg-rose-50 p-2 rounded-xl transition">
            <FaTimes size={20} />
          </button>
        </div>

        <div className="overflow-y-auto pr-2 space-y-5 text-sm text-slate-700">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <h3 className="font-black text-slate-800 mb-2 flex items-center gap-2"><FaFilter className="text-slate-500" /> Base de dados</h3>
            <p>O painel lê a tabela <strong>tratativas</strong> e cruza com <strong>tratativas_detalhes</strong> para mostrar o volume de tratativas e as ações executadas no período filtrado.</p>
          </div>

          <div className="bg-amber-50 p-4 rounded-xl border border-amber-200">
            <h3 className="font-black text-amber-900 mb-2 flex items-center gap-2"><FaClock className="text-amber-600" /> Pendentes e atrasadas</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Pendente:</strong> status contendo “pendente” ou “aberto”.</li>
              <li><strong>Atrasada:</strong> tratativa pendente criada há mais de 10 dias.</li>
            </ul>
          </div>

          <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200">
            <h3 className="font-black text-emerald-900 mb-2 flex items-center gap-2"><FaCheckCircle className="text-emerald-600" /> Concluídas</h3>
            <p>São consideradas concluídas as tratativas com status contendo “concluída”, “resolvido” ou “finalizada”.</p>
          </div>

          <div className="bg-blue-50 p-4 rounded-xl border border-blue-200">
            <h3 className="font-black text-blue-900 mb-2 flex items-center gap-2"><FaChartLine className="text-blue-600" /> Evolução mensal</h3>
            <p>O gráfico mensal considera o ano selecionado pela data de criação da tratativa (<strong>created_at</strong>) e separa total, pendentes, concluídas e atrasadas. O filtro de período fica reservado para os cards e rankings.</p>
          </div>

          <div className="bg-violet-50 p-4 rounded-xl border border-violet-200">
            <h3 className="font-black text-violet-900 mb-2 flex items-center gap-2"><FaTasks className="text-violet-600" /> Ações aplicadas</h3>
            <p>A aba de ações usa a tabela <strong>tratativas_detalhes</strong>. Uma tratativa pode aparecer sem ação aplicada caso ainda não tenha registro de detalhe.</p>
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

function TratativasModal({ title, rows, detalhes, onClose }) {
  const detalhesPorTratativa = useMemo(() => {
    const map = new Map();
    for (const d of detalhes || []) {
      if (!map.has(d.tratativa_id)) map.set(d.tratativa_id, []);
      map.get(d.tratativa_id).push(d);
    }
    return map;
  }, [detalhes]);

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm z-[70] animate-in fade-in duration-200 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="px-5 py-4 border-b bg-slate-50 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
              <FaClipboardList className="text-violet-600" /> {title}
            </h2>
            <p className="text-xs text-slate-500 font-semibold mt-1">{rows.length} tratativa(s) no recorte selecionado</p>
          </div>

          <button onClick={onClose} className="text-slate-400 hover:text-rose-500 hover:bg-rose-50 p-2 rounded-xl transition">
            <FaTimes size={20} />
          </button>
        </div>

        <div className="overflow-auto">
          <table className="w-full min-w-[1000px] text-sm text-left">
            <thead className="bg-white text-slate-500 uppercase font-black text-[10px] tracking-wider border-b sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Motorista</th>
                <th className="px-4 py-3">Linha</th>
                <th className="px-4 py-3">Ocorrência</th>
                <th className="px-4 py-3">Setor</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Descrição</th>
                <th className="px-4 py-3">Última ação</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {rows.map((t) => {
                const dets = detalhesPorTratativa.get(t.id) || [];
                const ultima = dets[0];

                return (
                  <tr key={t.id} className="hover:bg-slate-50 align-top">
                    <td className="px-4 py-3 font-bold text-slate-700 whitespace-nowrap">{formatDateBR(t.created_at)}</td>
                    <td className="px-4 py-3 font-bold text-slate-800 min-w-[220px]">{motoristaLabel(motoristaKey(t))}</td>
                    <td className="px-4 py-3 font-bold text-slate-700">{t.linha || "—"}</td>
                    <td className="px-4 py-3"><Badge tone="violet">{t.tipo_ocorrencia || "—"}</Badge></td>
                    <td className="px-4 py-3"><Badge tone="blue">{t.setor_origem || "—"}</Badge></td>
                    <td className="px-4 py-3"><Badge tone={statusTone(t.status)}>{t.status || "—"}</Badge></td>
                    <td className="px-4 py-3 text-slate-600 min-w-[280px] max-w-[420px]">{t.descricao || "—"}</td>
                    <td className="px-4 py-3 text-slate-600 min-w-[240px]">
                      {ultima ? (
                        <div>
                          <p className="font-black text-slate-800">{ultima.acao_aplicada || "Ação não informada"}</p>
                          <p className="text-xs text-slate-500 mt-1">{ultima.observacoes || "Sem observação"}</p>
                          <p className="text-[10px] text-slate-400 mt-1">{formatDateBR(ultima.created_at)} • {ultima.tratado_por_nome || ultima.tratado_por_login || "—"}</p>
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                );
              })}

              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-slate-400 font-bold">Sem tratativas no recorte.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="px-5 py-3 border-t bg-white flex justify-end">
          <button onClick={onClose} className="px-5 py-2.5 bg-slate-800 text-white font-black rounded-xl hover:bg-slate-700 transition">
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

/* =========================
   PAGE
========================= */

export default function TratativasResumo() {
  const hojeISO = useMemo(() => toISODateOnly(new Date()), []);
  const mesAtualIni = useMemo(() => startOfMonthISO(hojeISO), [hojeISO]);
  const mesAtualFim = useMemo(() => endOfMonthISO(hojeISO), [hojeISO]);
  const anoAtual = useMemo(() => hojeISO.slice(0, 4), [hojeISO]);
  const anosEvolucaoDisponiveis = useMemo(() => {
    const anoBase = Number(anoAtual);
    return Array.from({ length: 6 }, (_, idx) => String(anoBase - idx));
  }, [anoAtual]);

  const [loading, setLoading] = useState(false);
  const [errMsg, setErrMsg] = useState("");
  const [mostrarExplicacao, setMostrarExplicacao] = useState(false);
  const [abaAtiva, setAbaAtiva] = useState("GERAL");
  const [modalRecorte, setModalRecorte] = useState(null);
  const [anoEvolucao, setAnoEvolucao] = useState(anoAtual);

  const [filtros, setFiltros] = useState({
    dataInicio: mesAtualIni,
    dataFim: mesAtualFim,
    busca: "",
    setor: "",
    status: "",
    prioridades: [],
  });

  const [setoresDisponiveis, setSetoresDisponiveis] = useState([]);
  const [prioridadesDisponiveis, setPrioridadesDisponiveis] = useState([]);
  const [tratativas, setTratativas] = useState([]);
  const [tratativasEvolucao, setTratativasEvolucao] = useState([]);
  const [detalhes, setDetalhes] = useState([]);

  async function carregarSetores() {
    const { data } = await supabase.from("tratativas").select("setor_origem, prioridade");
    const setores = [...new Set((data || []).map((d) => d.setor_origem).filter(Boolean))];
    const prioridades = [...new Set((data || []).map((d) => normalizePrioridade(d.prioridade)))];

    setSetoresDisponiveis(setores.sort((a, b) => String(a).localeCompare(String(b), "pt-BR")));
    setPrioridadesDisponiveis(
      prioridades
        .filter(Boolean)
        .sort((a, b) => prioridadeSortValue(a) - prioridadeSortValue(b) || String(a).localeCompare(String(b), "pt-BR"))
    );
  }

  async function carregar(overrides = {}) {
    setLoading(true);
    setErrMsg("");

    try {
      const LINHA_FIELD = "linha";
      const filtrosAtuais = overrides.filtros || filtros;
      const anoAtualGrafico = overrides.anoEvolucao || anoEvolucao;
      const selectTratativas = `
        id,
        motorista_id,
        motorista_nome,
        motorista_chapa,
        tipo_ocorrencia,
        setor_origem,
        prioridade,
        status,
        descricao,
        ${LINHA_FIELD},
        created_at
      `;

      const aplicarFiltrosComuns = (query) => {
        if (filtrosAtuais.busca) {
          const b = filtrosAtuais.busca.trim();
          query = query.or(
            `motorista_nome.ilike.%${b}%,motorista_chapa.ilike.%${b}%,descricao.ilike.%${b}%,tipo_ocorrencia.ilike.%${b}%,${LINHA_FIELD}.ilike.%${b}%`
          );
        }

        if (filtrosAtuais.setor) query = query.eq("setor_origem", filtrosAtuais.setor);
        if (filtrosAtuais.status) query = query.ilike("status", `%${filtrosAtuais.status}%`);
        return query;
      };

      let q = aplicarFiltrosComuns(supabase.from("tratativas").select(selectTratativas));

      if (filtrosAtuais.dataInicio) q = q.gte("created_at", filtrosAtuais.dataInicio);
      if (filtrosAtuais.dataFim) q = q.lt("created_at", addDays(filtrosAtuais.dataFim, 1));

      const { data: tData, error: tErr } = await q
        .order("created_at", { ascending: false })
        .limit(100000);

      if (tErr) throw tErr;

      const list = filtrarPorPrioridades(tData || [], filtrosAtuais.prioridades);
      setTratativas(list);

      let qEvolucao = aplicarFiltrosComuns(supabase.from("tratativas").select(selectTratativas));
      qEvolucao = qEvolucao
        .gte("created_at", startOfYearISO(anoAtualGrafico))
        .lt("created_at", startOfNextYearISO(anoAtualGrafico));

      const { data: evolucaoData, error: evolucaoErr } = await qEvolucao
        .order("created_at", { ascending: true })
        .limit(100000);

      if (evolucaoErr) throw evolucaoErr;
      setTratativasEvolucao(filtrarPorPrioridades(evolucaoData || [], filtrosAtuais.prioridades));

      const ids = list.map((x) => x.id).filter(Boolean);
      if (!ids.length) {
        setDetalhes([]);
        return;
      }

      const allDet = [];
      const CHUNK = 500;
      for (let i = 0; i < ids.length; i += CHUNK) {
        const part = ids.slice(i, i + CHUNK);
        const { data: dData, error: dErr } = await supabase
          .from("tratativas_detalhes")
          .select(
            `
              id,
              created_at,
              tratativa_id,
              acao_aplicada,
              observacoes,
              tratado_por_login,
              tratado_por_nome
            `
          )
          .in("tratativa_id", part)
          .order("created_at", { ascending: false });

        if (dErr) throw dErr;
        allDet.push(...(dData || []));
      }

      setDetalhes(allDet);
    } catch (error) {
      console.error("Erro ao carregar resumo de tratativas:", error);
      setErrMsg(error.message || "Erro ao carregar dados.");
      setTratativas([]);
      setTratativasEvolucao([]);
      setDetalhes([]);
    } finally {
      setLoading(false);
    }
  }

  function aplicarFiltrosRapidos(nextFiltros) {
    setFiltros(nextFiltros);
    carregar({ filtros: nextFiltros });
  }

  function togglePrioridade(prioridade) {
    const atuais = filtros.prioridades || [];
    const nextPrioridades = atuais.includes(prioridade)
      ? atuais.filter((p) => p !== prioridade)
      : [...atuais, prioridade];
    aplicarFiltrosRapidos({ ...filtros, prioridades: nextPrioridades });
  }

  useEffect(() => {
    carregarSetores();
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const detalhesJoin = useMemo(() => {
    const byId = new Map();
    for (const t of tratativas) byId.set(t.id, t);

    return (detalhes || []).map((d) => {
      const t = byId.get(d.tratativa_id);
      return {
        ...d,
        motorista_nome: t?.motorista_nome ?? "",
        motorista_chapa: t?.motorista_chapa ?? "",
        motorista_id: t?.motorista_id ?? "",
        tipo_ocorrencia: t?.tipo_ocorrencia ?? "",
        setor_origem: t?.setor_origem ?? "",
        prioridade: t?.prioridade ?? "",
        status: t?.status ?? "",
        linha: t?.linha ?? "",
        tratativa_created_at: t?.created_at ?? "",
      };
    });
  }, [detalhes, tratativas]);

  const kpis = useMemo(() => {
    const total = tratativas.length;
    const pendentes = tratativas.filter((t) => isPendente(t.status));
    const concluidas = tratativas.filter((t) => isConcluida(t.status));
    const atrasadas = tratativas.filter(isAtrasada);
    const comAcao = new Set(detalhes.map((d) => d.tratativa_id)).size;

    return {
      total,
      pendentes: pendentes.length,
      concluidas: concluidas.length,
      atrasadas: atrasadas.length,
      comAcao,
      semAcao: Math.max(0, total - comAcao),
      taxaConclusao: total > 0 ? (concluidas.length / total) * 100 : 0,
    };
  }, [tratativas, detalhes]);

  const chartData = useMemo(() => {
    const map = new Map();
    const year = Number(anoEvolucao);

    for (let month = 1; month <= 12; month += 1) {
      const key = `${year}-${String(month).padStart(2, "0")}`;
      map.set(key, { mes: key, total: 0, pendentes: 0, concluidas: 0, atrasadas: 0 });
    }

    for (const t of tratativasEvolucao) {
      const key = monthKeyFromDate(t.created_at);
      if (!key) continue;
      if (!map.has(key)) continue;

      const item = map.get(key);
      item.total += 1;
      if (isPendente(t.status)) item.pendentes += 1;
      if (isConcluida(t.status)) item.concluidas += 1;
      if (isAtrasada(t)) item.atrasadas += 1;
    }

    return [...map.values()]
      .sort((a, b) => String(a.mes).localeCompare(String(b.mes)))
      .map((x) => ({ ...x, mesLabel: monthLabel(x.mes) }));
  }, [tratativasEvolucao, anoEvolucao]);

  const topMotoristas = useMemo(() => {
    const map = new Map();

    for (const t of tratativas) {
      const key = motoristaKey(t) || "Não informado";
      if (!map.has(key)) map.set(key, { key, nome: motoristaLabel(key), total: 0, pendentes: 0, concluidas: 0, atrasadas: 0 });
      const item = map.get(key);
      item.total += 1;
      if (isPendente(t.status)) item.pendentes += 1;
      if (isConcluida(t.status)) item.concluidas += 1;
      if (isAtrasada(t)) item.atrasadas += 1;
    }

    return [...map.values()].sort((a, b) => b.total - a.total || b.pendentes - a.pendentes).slice(0, 10);
  }, [tratativas]);

  const topOcorrencias = useMemo(() => {
    const map = countBy(tratativas, (t) => normStr(t.tipo_ocorrencia) || "Sem ocorrência");
    return sortMapDesc(map).slice(0, 10).map(([nome, total]) => ({ key: nome, nome, total }));
  }, [tratativas]);

  const topLinhas = useMemo(() => {
    const map = countBy(tratativas, (t) => normStr(t.linha) || "Sem linha");
    return sortMapDesc(map).slice(0, 10).map(([nome, total]) => ({ key: nome, nome, total }));
  }, [tratativas]);

  const topSetores = useMemo(() => {
    const map = countBy(tratativas, (t) => normStr(t.setor_origem) || "Sem setor");
    return sortMapDesc(map).slice(0, 10).map(([nome, total]) => ({ key: nome, nome, total }));
  }, [tratativas]);

  const topAcoes = useMemo(() => {
    const map = countBy(detalhesJoin, (d) => normStr(d.acao_aplicada) || "Não aplicada");
    return sortMapDesc(map).slice(0, 10).map(([nome, total]) => ({ key: nome, nome, total }));
  }, [detalhesJoin]);

  function abrirRecorte(tipo, valor) {
    let rows = tratativas;

    if (tipo === "motorista") rows = rows.filter((t) => motoristaKey(t) === valor);
    if (tipo === "ocorrencia") rows = rows.filter((t) => normStr(t.tipo_ocorrencia) === normStr(valor));
    if (tipo === "linha") rows = rows.filter((t) => normStr(t.linha || "Sem linha") === normStr(valor));
    if (tipo === "setor") rows = rows.filter((t) => normStr(t.setor_origem || "Sem setor") === normStr(valor));

    if (tipo === "acao") {
      const dets = detalhesJoin.filter((d) => normStr(d.acao_aplicada || "Não aplicada") === normStr(valor));
      const ids = new Set(dets.map((d) => d.tratativa_id));
      rows = rows.filter((t) => ids.has(t.id));
    }

    setModalRecorte({
      title: `${tipo.charAt(0).toUpperCase()}${tipo.slice(1)}: ${tipo === "motorista" ? motoristaLabel(valor) : valor}`,
      rows,
    });
  }

  function baixarExcelUnificado() {
    const sheetTratativas = tratativas.map((t) => ({
      id: t.id,
      created_at: t.created_at,
      motorista_chapa: t.motorista_chapa,
      motorista_nome: t.motorista_nome,
      linha: t.linha,
      tipo_ocorrencia: t.tipo_ocorrencia,
      setor_origem: t.setor_origem,
      prioridade: t.prioridade,
      status: t.status,
      descricao: t.descricao,
    }));

    const sheetDetalhes = detalhesJoin.map((d) => ({
      id: d.id,
      created_at: d.created_at,
      tratativa_id: d.tratativa_id,
      motorista_chapa: d.motorista_chapa,
      motorista_nome: d.motorista_nome,
      linha: d.linha,
      tipo_ocorrencia: d.tipo_ocorrencia,
      status: d.status,
      acao_aplicada: d.acao_aplicada,
      observacoes: d.observacoes,
      tratado_por_login: d.tratado_por_login,
      tratado_por_nome: d.tratado_por_nome,
    }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheetTratativas), "Tratativas");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheetDetalhes), "Detalhes");
    XLSX.writeFile(wb, `tratativas_resumo_${filtros.dataInicio || "inicio"}_${filtros.dataFim || "fim"}.xlsx`);
  }

  const rankingColumnsBasicas = [
    {
      key: "nome",
      label: "Nome",
      render: (r, idx) => (
        <span className="font-black text-slate-800">
          <span className="text-slate-400 mr-2">#{idx + 1}</span>
          {r.nome}
        </span>
      ),
    },
    { key: "total", label: "Total", align: "center", render: (r) => <span className="font-black text-rose-600">{fmtInt(r.total)}</span> },
  ];

  return (
    <div className="min-h-screen bg-slate-50 p-4 space-y-5">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 md:p-5">
        <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-50 text-violet-700 text-xs font-black border border-violet-200">
              <FaClipboardList /> Gestão de Tratativas
            </div>

            <h1 className="mt-3 text-2xl font-black text-slate-800">Painel de tratativas</h1>

            <p className="text-sm text-slate-500 mt-1 flex items-center gap-2 font-semibold">
              <FaCalendarAlt /> Visão analítica de tratativas, pendências, ações aplicadas e rankings.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => exportarCSV(tratativas, `Tratativas_${filtros.dataInicio}_a_${filtros.dataFim}`)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-500 transition shadow-sm"
            >
              <FaDownload /> Exportar CSV
            </button>

            <button
              onClick={baixarExcelUnificado}
              disabled={loading || tratativas.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-green-700 text-white font-bold hover:bg-green-600 transition shadow-sm disabled:bg-slate-300"
            >
              <FaDownload /> Excel Unificado
            </button>

            <button
              onClick={() => setMostrarExplicacao(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-100 text-blue-800 font-bold hover:bg-blue-200 transition"
            >
              <FaInfoCircle /> Entender Cálculos
            </button>

            <button
              onClick={() => carregar()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-800 bg-slate-800 text-white font-black hover:bg-slate-700 transition"
            >
              <FaRedo /> Atualizar
            </button>
          </div>
        </div>

        <div className="mt-5 pt-5 border-t grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-3 items-end">
          <div className="xl:col-span-1">
            <label className="text-[10px] font-black text-slate-500 uppercase mb-1 block">Data início</label>
            <input
              type="date"
              value={filtros.dataInicio}
              onChange={(e) => setFiltros((f) => ({ ...f, dataInicio: e.target.value }))}
              className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-blue-200 outline-none"
            />
          </div>

          <div className="xl:col-span-1">
            <label className="text-[10px] font-black text-slate-500 uppercase mb-1 block">Data fim</label>
            <input
              type="date"
              value={filtros.dataFim}
              onChange={(e) => setFiltros((f) => ({ ...f, dataFim: e.target.value }))}
              className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-blue-200 outline-none"
            />
          </div>

          <div className="xl:col-span-2 relative">
            <label className="text-[10px] font-black text-slate-500 uppercase mb-1 block">Busca</label>
            <FaSearch className="absolute left-3 bottom-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Motorista, ocorrência, descrição, linha..."
              value={filtros.busca}
              onChange={(e) => setFiltros((f) => ({ ...f, busca: e.target.value }))}
              className="w-full pl-9 border border-slate-300 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-blue-200 outline-none"
            />
          </div>

          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase mb-1 block">Setor</label>
            <select
              value={filtros.setor}
              onChange={(e) => setFiltros((f) => ({ ...f, setor: e.target.value }))}
              className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-blue-200 outline-none bg-white"
            >
              <option value="">Todos</option>
              {setoresDisponiveis.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase mb-1 block">Status</label>
            <select
              value={filtros.status}
              onChange={(e) => setFiltros((f) => ({ ...f, status: e.target.value }))}
              className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-blue-200 outline-none bg-white"
            >
              <option value="">Todos</option>
              <option value="Pendente">Pendente</option>
              <option value="Aberto">Aberto</option>
              <option value="Resolvido">Resolvido</option>
              <option value="Concluída">Concluída</option>
            </select>
          </div>
          <div className="md:col-span-2 xl:col-span-6">
            <label className="text-[10px] font-black text-slate-500 uppercase mb-1 block">Prioridade</label>
            <div className="flex flex-wrap gap-2">
              {(prioridadesDisponiveis.length ? prioridadesDisponiveis : ["Gravíssima", "Crítica", "Urgente", "Alta", "Média", "Baixa", "Sem prioridade"]).map((prioridade) => {
                const active = (filtros.prioridades || []).includes(prioridade);
                return (
                  <button
                    key={prioridade}
                    type="button"
                    onClick={() => togglePrioridade(prioridade)}
                    className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-black transition ${
                      active
                        ? "border-violet-600 bg-violet-600 text-white shadow-sm"
                        : "border-slate-200 bg-white text-slate-700 hover:border-violet-200 hover:bg-violet-50"
                    }`}
                  >
                    <FaFilter className={active ? "text-white" : "text-violet-500"} />
                    {prioridade}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={() => aplicarFiltrosRapidos({ dataInicio: mesAtualIni, dataFim: mesAtualFim, busca: "", setor: "", status: "", prioridades: [] })}
            className="px-4 py-2.5 rounded-xl font-black text-sm bg-blue-50 text-blue-700 hover:bg-blue-100 transition shadow-sm border border-blue-200"
          >
            Mês Atual
          </button>

          <button
            onClick={() => aplicarFiltrosRapidos({ dataInicio: "", dataFim: "", busca: "", setor: "", status: "", prioridades: [] })}
            className="px-4 py-2.5 rounded-xl font-black text-sm bg-slate-100 text-slate-700 hover:bg-slate-200 transition"
          >
            Limpar filtros
          </button>

          <button
            onClick={() => carregar()}
            disabled={loading}
            className="px-4 py-2.5 rounded-xl font-black text-sm bg-violet-600 text-white hover:bg-violet-700 transition disabled:bg-slate-300"
          >
            {loading ? "Carregando..." : "Aplicar"}
          </button>
        </div>

        {errMsg && (
          <div className="mt-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-3 text-sm font-bold flex items-center gap-2">
            <FaExclamationTriangle /> {errMsg}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <CardKPI title="Total de Tratativas" value={loading ? "-" : fmtInt(kpis.total)} sub={`${fmtInt(kpis.comAcao)} com ação aplicada`} icon={<FaFolderOpen />} tone="slate" />
        <CardKPI title="Pendentes" value={loading ? "-" : fmtInt(kpis.pendentes)} sub={`${fmtInt(kpis.semAcao)} sem ação registrada`} icon={<FaClock />} tone="amber" />
        <CardKPI title="Concluídas" value={loading ? "-" : fmtInt(kpis.concluidas)} sub={`Taxa: ${kpis.taxaConclusao.toFixed(1).replace(".", ",")}%`} icon={<FaCheckCircle />} tone="emerald" />
        <CardKPI title="Atrasadas >10 dias" value={loading ? "-" : fmtInt(kpis.atrasadas)} sub="Pendentes antigas" icon={<FaExclamationCircle />} tone="rose" />
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-2 flex flex-wrap gap-2">
        <TabButton active={abaAtiva === "GERAL"} onClick={() => setAbaAtiva("GERAL")} icon={<FaChartLine />}>Resumo</TabButton>
        <TabButton active={abaAtiva === "MOTORISTAS"} onClick={() => setAbaAtiva("MOTORISTAS")} icon={<FaUsers />}>Motoristas</TabButton>
        <TabButton active={abaAtiva === "OCORRENCIAS"} onClick={() => setAbaAtiva("OCORRENCIAS")} icon={<FaExclamationTriangle />}>Ocorrências</TabButton>
        <TabButton active={abaAtiva === "LINHAS_SETORES"} onClick={() => setAbaAtiva("LINHAS_SETORES")} icon={<FaLayerGroup />}>Linhas e Setores</TabButton>
        <TabButton active={abaAtiva === "ACOES"} onClick={() => setAbaAtiva("ACOES")} icon={<FaTasks />}>Ações</TabButton>
        <TabButton active={abaAtiva === "BASE"} onClick={() => setAbaAtiva("BASE")} icon={<FaTable />}>Base</TabButton>
      </div>

      {abaAtiva === "GERAL" && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm xl:col-span-3">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
              <div>
                <h3 className="text-lg font-black text-slate-800">Evolução Mensal de Tratativas</h3>
                <p className="text-xs text-slate-500 font-semibold">Histórico anual em linhas. Os cards continuam seguindo o período filtrado.</p>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase mb-1 block">Ano do histórico</label>
                <select
                  value={anoEvolucao}
                  onChange={(e) => {
                    const nextAno = e.target.value;
                    setAnoEvolucao(nextAno);
                    carregar({ anoEvolucao: nextAno });
                  }}
                  className="border border-slate-300 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-blue-200 outline-none bg-white"
                >
                  {anosEvolucaoDisponiveis.map((ano) => (
                    <option key={ano} value={ano}>{ano}</option>
                  ))}
                </select>
              </div>
            </div>

            {tratativasEvolucao.length === 0 && !loading ? (
              <div className="h-72 flex items-center justify-center text-sm font-bold text-slate-400">Nenhum dado encontrado para o ano selecionado.</div>
            ) : (
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 35, right: 24, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="mesLabel" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 11, fontWeight: "bold" }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 11 }} />
                    <Tooltip contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }} />
                    <Legend iconType="circle" wrapperStyle={{ paddingTop: "20px", fontSize: "12px", fontWeight: "bold" }} />
                    <Line type="monotone" dataKey="total" name="Total" stroke="#2563eb" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 6 }}>
                      <LabelList dataKey="total" position="top" formatter={fmtChartLabel} style={{ fill: "#2563eb", fontSize: 10, fontWeight: 900 }} />
                    </Line>
                    <Line type="monotone" dataKey="pendentes" name="Pendentes" stroke="#f59e0b" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 6 }}>
                      <LabelList dataKey="pendentes" position="bottom" formatter={fmtChartLabel} style={{ fill: "#b45309", fontSize: 10, fontWeight: 900 }} />
                    </Line>
                    <Line type="monotone" dataKey="concluidas" name="Concluídas" stroke="#10b981" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 6 }}>
                      <LabelList dataKey="concluidas" position="top" formatter={fmtChartLabel} style={{ fill: "#047857", fontSize: 10, fontWeight: 900 }} />
                    </Line>
                    <Line type="monotone" dataKey="atrasadas" name="Atrasadas" stroke="#ef4444" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 6 }}>
                      <LabelList dataKey="atrasadas" position="bottom" formatter={fmtChartLabel} style={{ fill: "#dc2626", fontSize: 10, fontWeight: 900 }} />
                    </Line>
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      )}

      {abaAtiva === "MOTORISTAS" && (
        <RankingTable
          title="Top 10 Motoristas"
          icon={<FaUsers className="text-slate-400" />}
          rows={topMotoristas}
          onRowClick={(r) => abrirRecorte("motorista", r.key)}
          columns={[
            { key: "nome", label: "Motorista", render: (r, idx) => <span className="font-black text-slate-800"><span className="text-slate-400 mr-2">#{idx + 1}</span>{r.nome}</span> },
            { key: "total", label: "Total", align: "center", render: (r) => <span className="font-black text-rose-600">{fmtInt(r.total)}</span> },
            { key: "pendentes", label: "Pendentes", align: "center", render: (r) => <span className="font-bold text-amber-600">{fmtInt(r.pendentes)}</span> },
            { key: "concluidas", label: "Concluídas", align: "center", render: (r) => <span className="font-bold text-emerald-600">{fmtInt(r.concluidas)}</span> },
            { key: "atrasadas", label: "Atrasadas", align: "center", render: (r) => <span className="font-bold text-rose-600">{fmtInt(r.atrasadas)}</span> },
          ]}
        />
      )}

      {abaAtiva === "OCORRENCIAS" && (
        <RankingTable
          title="Top Ocorrências"
          icon={<FaExclamationTriangle className="text-slate-400" />}
          rows={topOcorrencias}
          columns={rankingColumnsBasicas}
          onRowClick={(r) => abrirRecorte("ocorrencia", r.key)}
        />
      )}

      {abaAtiva === "LINHAS_SETORES" && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <RankingTable
            title="Top Linhas"
            icon={<FaRoad className="text-slate-400" />}
            rows={topLinhas}
            columns={rankingColumnsBasicas}
            onRowClick={(r) => abrirRecorte("linha", r.key)}
          />
          <RankingTable
            title="Top Setores"
            icon={<FaUserTie className="text-slate-400" />}
            rows={topSetores}
            columns={rankingColumnsBasicas}
            onRowClick={(r) => abrirRecorte("setor", r.key)}
          />
        </div>
      )}

      {abaAtiva === "ACOES" && (
        <RankingTable
          title="Top Ações Aplicadas"
          icon={<FaTasks className="text-slate-400" />}
          rows={topAcoes}
          columns={rankingColumnsBasicas}
          onRowClick={(r) => abrirRecorte("acao", r.key)}
        />
      )}

      {abaAtiva === "BASE" && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <h3 className="text-base font-black text-slate-800 flex items-center gap-2 mb-4">
            <FaTable className="text-slate-400" /> Base de Tratativas
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-sm text-left">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[10px] border-b">
                <tr>
                  <th className="p-3 font-black">Data</th>
                  <th className="p-3 font-black">Motorista</th>
                  <th className="p-3 font-black">Linha</th>
                  <th className="p-3 font-black">Ocorrência</th>
                  <th className="p-3 font-black">Setor</th>
                  <th className="p-3 font-black">Prioridade</th>
                  <th className="p-3 font-black">Status</th>
                  <th className="p-3 font-black">Descrição</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tratativas.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50">
                    <td className="p-3 font-bold text-slate-700">{formatDateBR(t.created_at)}</td>
                    <td className="p-3 font-black text-slate-800">{motoristaLabel(motoristaKey(t))}</td>
                    <td className="p-3 font-bold text-slate-700">{t.linha || "—"}</td>
                    <td className="p-3"><Badge tone="violet">{t.tipo_ocorrencia || "—"}</Badge></td>
                    <td className="p-3"><Badge tone="blue">{t.setor_origem || "—"}</Badge></td>
                    <td className="p-3"><Badge tone="slate">{t.prioridade || "—"}</Badge></td>
                    <td className="p-3"><Badge tone={statusTone(t.status)}>{t.status || "—"}</Badge></td>
                    <td className="p-3 text-slate-600 max-w-[420px] truncate" title={t.descricao || ""}>{t.descricao || "—"}</td>
                  </tr>
                ))}
                {tratativas.length === 0 && !loading && (
                  <tr><td colSpan={8} className="p-8 text-center text-slate-400 font-bold">Sem dados</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {loading && (
        <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-[1px] flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl px-6 py-4 shadow-xl border border-slate-200 font-black text-slate-800">
            Carregando Tratativas...
          </div>
        </div>
      )}

      {mostrarExplicacao && <ExplicacaoModal onClose={() => setMostrarExplicacao(false)} />}

      {modalRecorte && (
        <TratativasModal
          title={modalRecorte.title}
          rows={modalRecorte.rows}
          detalhes={detalhes}
          onClose={() => setModalRecorte(null)}
        />
      )}
    </div>
  );
}
