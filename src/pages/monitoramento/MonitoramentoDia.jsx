import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  FaArrowLeft,
  FaCar,
  FaCheckCircle,
  FaChevronDown,
  FaChevronLeft,
  FaChevronRight,
  FaDownload,
  FaEllipsisH,
  FaFileAlt,
  FaFilter,
  FaHome,
  FaMagic,
  FaQuestionCircle,
  FaSearch,
  FaSortAmountDown,
  FaSortAmountUp,
  FaTimesCircle,
  FaWrench,
} from "react-icons/fa";
import * as XLSX from "xlsx";
import { supabase } from "../../supabase";

const STORAGE_KEY = "inove.monitoramento.dia.filters.v2";
const PAGE_SIZE = 200;

const ACTION_TONES = {
  "Confirmar Similaridade": "emerald",
  "Confirmar Irregularidade": "rose",
  "Confirmar Inconclusivo": "amber",
  "Inconsistencia Tecnica": "slate",
};

const CATEGORY_TONES = {
  PESSOA_VISIVEL_SIMILAR: "emerald",
  PESSOA_VISIVEL_DIFERENTE: "rose",
  SEM_PESSOA: "slate",
  INCONCLUSIVO: "amber",
  ERRO: "slate",
};

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function readSavedState(day) {
  if (typeof window === "undefined" || !day) return {};
  try {
    return JSON.parse(window.localStorage.getItem(`${STORAGE_KEY}:${day}`) || "{}") || {};
  } catch {
    return {};
  }
}

function writeSavedState(day, state) {
  if (typeof window === "undefined" || !day) return;
  try {
    window.localStorage.setItem(`${STORAGE_KEY}:${day}`, JSON.stringify(state));
  } catch {}
}

function formatDateBR(isoDate) {
  const m = String(isoDate || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : isoDate || "-";
}

function formatWeekdayBR(isoDate) {
  const d = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("pt-BR", { weekday: "long" }).format(d).replace(/^\w/, (c) => c.toUpperCase());
}

function formatDateTimeBR(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (!Number.isNaN(d.getTime())) return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  return String(value);
}

function toneClasses(tone) {
  const map = {
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
    rose: "border-rose-200 bg-rose-50 text-rose-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    slate: "border-slate-200 bg-slate-50 text-slate-700",
  };
  return map[tone] || map.slate;
}

function topTabClass(active) {
  return active
    ? "border-b-4 border-blue-600 text-blue-600 bg-white"
    : "text-slate-500 bg-white hover:bg-slate-50";
}

function NavTab({ to, icon, label, active = false }) {
  return (
    <Link to={to} className={`flex min-h-[68px] items-center justify-center gap-3 px-4 py-4 text-sm font-bold transition ${topTabClass(active)}`}>
      <span className={`text-lg ${active ? "text-blue-600" : "text-slate-400"}`}>{icon}</span>
      <span>{label}</span>
    </Link>
  );
}

function SummaryCard({ title, value, tone = "blue" }) {
  return (
    <div className={`rounded-[18px] border p-4 shadow-sm ${toneClasses(tone)}`}>
      <p className="text-[11px] font-black uppercase tracking-[0.18em] opacity-85">{title}</p>
      <p className="mt-3 text-[34px] font-black leading-none text-slate-900">{value}</p>
    </div>
  );
}

function FilterBadge({ children, tone = "slate" }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-black ${toneClasses(tone)}`}>
      {children}
    </span>
  );
}

function Thumb({ src, alt }) {
  return src ? (
    <img src={src} alt={alt} className="h-16 w-16 rounded-2xl border border-slate-200 object-cover" loading="lazy" decoding="async" />
  ) : (
    <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-slate-400">
      <FaFileAlt />
    </div>
  );
}

export default function MonitoramentoDia() {
  const navigate = useNavigate();
  const { dia } = useParams();
  const saved = useMemo(() => readSavedState(dia), [dia]);

  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(saved.search || "");
  const [acao, setAcao] = useState(saved.acao || "");
  const [categoria, setCategoria] = useState(saved.categoria || "");
  const [sortField, setSortField] = useState(saved.sortField || "created_at");
  const [sortAsc, setSortAsc] = useState(Boolean(saved.sortAsc));
  const [page, setPage] = useState(saved.page || 1);
  const [error, setError] = useState("");

  const fetchDay = useCallback(async () => {
    if (!dia) return;
    setLoading(true);
    setError("");

    const summaryQuery = supabase
      .from("vw_monitoramento_inspecoes_diario")
      .select("dt_evento,total_laudos,total_similaridade,total_irregularidade,total_inconclusivo,total_tecnica,total_rostos_camera,score_medio,score_medio_biometrico,score_medio_face_mesh,prefixos_distintos")
      .eq("dt_evento", dia)
      .maybeSingle();

    const rowsQuery = supabase
      .from("vw_monitoramento_inspecoes_base")
      .select(
        "id,dt_evento,created_at,data_hora_evento,nome,registro,prefixo,veiculo,acao_prevista,categoria,score,score_biometrico,similaridade_arcface,quantidade_rostos_camera,img_cadastro_url,img_camera_url,codigo_usuario,codigo_cartao,tipo_cartao,status_inspecao,status_cartao"
      )
      .eq("dt_evento", dia)
      .order("created_at", { ascending: false });

    const [{ data: summaryData, error: summaryError }, { data: rowsData, error: rowsError }] = await Promise.all([summaryQuery, rowsQuery]);

    if (summaryError || rowsError) {
      setSummary(null);
      setRows([]);
      setError(summaryError?.message || rowsError?.message || "Nao foi possivel carregar os laudos do dia.");
      setLoading(false);
      return;
    }

    setSummary(summaryData || null);
    setRows(Array.isArray(rowsData) ? rowsData : []);
    setLoading(false);
  }, [dia]);

  useEffect(() => {
    fetchDay();
  }, [fetchDay]);

  useEffect(() => {
    setSearch(saved.search || "");
    setAcao(saved.acao || "");
    setCategoria(saved.categoria || "");
    setSortField(saved.sortField || "created_at");
    setSortAsc(Boolean(saved.sortAsc));
    setPage(saved.page || 1);
  }, [dia, saved]);

  useEffect(() => {
    writeSavedState(dia, { search, acao, categoria, sortField, sortAsc, page });
  }, [dia, search, acao, categoria, sortField, sortAsc, page]);

  useEffect(() => {
    setPage(1);
  }, [search, acao, categoria, sortField, sortAsc, dia]);

  const actionOptions = useMemo(
    () => Array.from(new Set(rows.map((row) => row.acao_prevista).filter(Boolean))).sort((a, b) => String(a).localeCompare(String(b))),
    [rows]
  );

  const categoryOptions = useMemo(
    () => Array.from(new Set(rows.map((row) => row.categoria).filter(Boolean))).sort((a, b) => String(a).localeCompare(String(b))),
    [rows]
  );

  const filteredRows = useMemo(() => {
    const q = normalizeText(search);
    return rows.filter((row) => {
      if (acao && row.acao_prevista !== acao) return false;
      if (categoria && row.categoria !== categoria) return false;
      if (!q) return true;

      const haystack = normalizeText(
        [
          row.nome,
          row.registro,
          row.prefixo,
          row.veiculo,
          row.codigo_usuario,
          row.codigo_cartao,
          row.tipo_cartao,
          row.status_inspecao,
          row.status_cartao,
          row.categoria,
          row.acao_prevista,
        ]
          .filter(Boolean)
          .join(" ")
      );
      return haystack.includes(q);
    });
  }, [rows, search, acao, categoria]);

  const orderedRows = useMemo(() => {
    const list = [...filteredRows];
    const numericFields = new Set(["score", "score_biometrico", "similaridade_arcface", "quantidade_rostos_camera"]);

    list.sort((a, b) => {
      const av = a[sortField];
      const bv = b[sortField];
      if (numericFields.has(sortField)) {
        const na = Number(av ?? -1);
        const nb = Number(bv ?? -1);
        return sortAsc ? na - nb : nb - na;
      }
      const sa = String(av ?? "");
      const sb = String(bv ?? "");
      return sortAsc ? sa.localeCompare(sb) : sb.localeCompare(sa);
    });

    return list;
  }, [filteredRows, sortField, sortAsc]);

  const totalPages = Math.max(1, Math.ceil(orderedRows.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = orderedRows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => {
    if (page !== currentPage) setPage(currentPage);
  }, [currentPage, page]);

  const kpis = useMemo(
    () => ({
      total: summary?.total_laudos ?? rows.length,
      similaridade: summary?.total_similaridade ?? rows.filter((row) => row.acao_prevista === "Confirmar Similaridade").length,
      irregularidade: summary?.total_irregularidade ?? rows.filter((row) => row.acao_prevista === "Confirmar Irregularidade").length,
      inconclusivo: summary?.total_inconclusivo ?? rows.filter((row) => row.acao_prevista === "Confirmar Inconclusivo").length,
      tecnica: summary?.total_tecnica ?? rows.filter((row) => row.acao_prevista === "Inconsistencia Tecnica").length,
    }),
    [summary, rows]
  );

  const exportExcel = () => {
    const sheet = orderedRows.map((row) => ({
      Data: formatDateBR(row.dt_evento),
      "Data/Hora": row.data_hora_evento || formatDateTimeBR(row.created_at),
      Nome: row.nome || "",
      Registro: row.registro || "",
      Prefixo: row.prefixo || row.veiculo || "",
      Ação: row.acao_prevista || "",
      Categoria: row.categoria || "",
      Score: row.score ?? "",
      "Score Biometrico": row.score_biometrico ?? "",
      ArcFace: row.similaridade_arcface ?? "",
      "Rostos Camera": row.quantidade_rostos_camera ?? "",
      "Status Inspecao": row.status_inspecao || "",
      "Status Cartao": row.status_cartao || "",
      "Codigo Usuario": row.codigo_usuario || "",
      "Codigo Cartao": row.codigo_cartao || "",
      "Tipo Cartao": row.tipo_cartao || "",
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(sheet);
    XLSX.utils.book_append_sheet(wb, ws, "Laudos");
    XLSX.writeFile(wb, `monitoramento_${dia || "dia"}_${String(new Date().toISOString().slice(0, 10))}.xlsx`);
  };

  const clearFilters = () => {
    setSearch("");
    setAcao("");
    setCategoria("");
  };

  const orderButtons = [
    { field: "created_at", label: "Data" },
    { field: "score", label: "Score" },
    { field: "score_biometrico", label: "Biometria" },
    { field: "nome", label: "Nome" },
  ];

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-4">
        <header className="rounded-[28px] border border-slate-200 bg-white px-6 py-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-sm">
                <FaFileAlt className="text-lg" />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.24em] text-blue-600">VISION WEB</p>
                <h1 className="mt-2 text-[28px] font-black tracking-tight text-slate-900 md:text-[34px]">
                  Monitoramento de Inspeções
                </h1>
              </div>
            </div>

            <div className="grid overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:min-w-[760px] lg:grid-cols-4">
              <NavTab to="/painel" icon={<FaHome />} label="Dashboard" />
              <NavTab to={`/monitoramento/dia/${dia}`} icon={<FaFileAlt />} label="Laudos" active />
              <NavTab to="/embarcados-central" icon={<FaCar />} label="Veículos" />
              <NavTab to="/monitoramento/prompt-gemini" icon={<FaMagic />} label="Prompt GEMINI" />
            </div>
          </div>
        </header>

        <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)] md:p-6">
          <div className="flex flex-col gap-5">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => navigate("/monitoramento")}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                <FaArrowLeft /> Voltar para o calendário
              </button>
            </div>

            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 shadow-sm">
                  <FaFileAlt className="text-xl" />
                </div>
                <div>
                  <h2 className="text-2xl font-black tracking-tight text-slate-900 md:text-[28px]">
                    Laudos do dia {formatDateBR(dia)}
                  </h2>
                  <p className="text-sm font-semibold text-slate-500">{formatWeekdayBR(dia)}</p>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                <SummaryCard title="Total de laudos" value={kpis.total} tone="blue" />
                <SummaryCard title="Similaridade" value={kpis.similaridade} tone="emerald" />
                <SummaryCard title="Irregularidade" value={kpis.irregularidade} tone="rose" />
                <SummaryCard title="Inconclusivo" value={kpis.inconclusivo} tone="amber" />
                <SummaryCard title="Técnica" value={kpis.tecnica} tone="slate" />
              </div>
            </div>

            <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_220px_220px]">
              <label className="relative block">
                <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-500">Buscar</span>
                <FaSearch className="pointer-events-none absolute left-4 top-[42px] text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por nome, cartão, usuário ou registro..."
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm font-semibold outline-none transition focus:border-blue-400 focus:bg-white"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-500">Ação</span>
                <div className="relative">
                  <select
                    value={acao}
                    onChange={(e) => setAcao(e.target.value)}
                    className="w-full appearance-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 pr-10 text-sm font-semibold outline-none transition focus:border-blue-400 focus:bg-white"
                  >
                    <option value="">Todas</option>
                    {actionOptions.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                  <FaChevronDown className="pointer-events-none absolute right-4 top-4 text-xs text-slate-400" />
                </div>
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-500">Categoria</span>
                <div className="relative">
                  <select
                    value={categoria}
                    onChange={(e) => setCategoria(e.target.value)}
                    className="w-full appearance-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 pr-10 text-sm font-semibold outline-none transition focus:border-blue-400 focus:bg-white"
                  >
                    <option value="">Todas</option>
                    {categoryOptions.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                  <FaChevronDown className="pointer-events-none absolute right-4 top-4 text-xs text-slate-400" />
                </div>
              </label>
            </div>

            <div className="flex flex-col gap-3 rounded-[22px] border border-slate-100 bg-slate-50/80 p-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-black text-slate-500">Ordenar por:</span>
                {orderButtons.map((item) => (
                  <button
                    key={item.field}
                    type="button"
                    onClick={() => {
                      if (sortField === item.field) setSortAsc((v) => !v);
                      else {
                        setSortField(item.field);
                        setSortAsc(false);
                      }
                    }}
                    className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-black transition ${
                      sortField === item.field ? "bg-slate-900 text-white shadow-sm" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {item.label}
                    {sortField === item.field ? sortAsc ? <FaSortAmountUp className="text-[11px]" /> : <FaSortAmountDown className="text-[11px]" /> : null}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={exportExcel}
                disabled={!orderedRows.length}
                className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-5 py-2.5 text-sm font-black text-emerald-700 shadow-sm transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <FaDownload /> Baixar Excel
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-semibold text-slate-600">
                Mostrando {orderedRows.length ? (currentPage - 1) * PAGE_SIZE + 1 : 0} a {Math.min(currentPage * PAGE_SIZE, orderedRows.length)} de {orderedRows.length} resultados
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-600">Filtros salvos</span>
                {error ? <span className="rounded-full bg-rose-100 px-3 py-1.5 text-xs font-black text-rose-700">{error}</span> : null}
                <button
                  type="button"
                  onClick={clearFilters}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-700 shadow-sm transition hover:bg-slate-50"
                >
                  <FaFilter /> Limpar filtros
                </button>
              </div>
            </div>

            {loading ? (
              <div className="rounded-[22px] border border-dashed border-slate-200 bg-slate-50/70 py-16 text-center text-sm font-bold text-slate-400">
                Carregando laudos do dia...
              </div>
            ) : orderedRows.length === 0 ? (
              <div className="rounded-[22px] border border-dashed border-slate-200 bg-slate-50/70 py-16 text-center">
                <p className="text-sm font-bold text-slate-700">Nenhum laudo encontrado com os filtros atuais.</p>
                <p className="mt-1 text-sm text-slate-500">Tente limpar os filtros ou revisar a data selecionada.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2 px-2 text-xs font-semibold text-slate-500">
                  <span>{pageRows.length} laudo(s) nesta página</span>
                  {acao ? <FilterBadge tone={ACTION_TONES[acao] || "slate"}>{acao}</FilterBadge> : null}
                  {categoria ? <FilterBadge tone={CATEGORY_TONES[categoria] || "slate"}>{categoria}</FilterBadge> : null}
                </div>

                <div className="space-y-3">
                  {pageRows.map((row) => {
                    const actionTone = ACTION_TONES[row.acao_prevista] || "slate";
                    const categoryTone = CATEGORY_TONES[row.categoria] || "slate";

                    return (
                      <article key={row.id} className="rounded-[22px] border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
                        <div className="flex flex-col gap-4 p-4 xl:flex-row xl:items-center">
                          <div className="flex items-start gap-3">
                            <input type="checkbox" className="mt-5 h-4 w-4 rounded border-slate-300" />
                            <div className="flex gap-2">
                              <Thumb src={row.img_cadastro_url} alt="Cadastro" />
                              <Thumb src={row.img_camera_url} alt="Camera" />
                            </div>
                          </div>

                          <div className="min-w-0 flex-1">
                            <p className="truncate text-lg font-black text-slate-900">{row.nome || "Sem nome"}</p>
                            <p className="mt-1 text-sm font-semibold text-slate-500">
                              {row.registro || "-"} <span className="mx-2 text-slate-300">|</span> {formatDateTimeBR(row.data_hora_evento || row.created_at)}
                            </p>
                          </div>

                          <div className="grid gap-2 md:grid-cols-2 xl:min-w-[640px] xl:grid-cols-4">
                            <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-3">
                              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-blue-600">Score Final</p>
                              <p className="mt-1 text-2xl font-black text-blue-600">{row.score ?? "-"}</p>
                            </div>
                            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-3">
                              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-emerald-700">Biometria</p>
                              <p className="mt-1 text-2xl font-black text-emerald-700">{row.score_biometrico ?? "-"}</p>
                            </div>
                            <div className="rounded-2xl border border-amber-100 bg-amber-50/70 p-3">
                              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-amber-700">ArcFace</p>
                              <p className="mt-1 text-2xl font-black text-amber-700">{row.similaridade_arcface ?? "-"}</p>
                            </div>
                            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Rostos</p>
                              <p className="mt-1 text-2xl font-black text-slate-900">{row.quantidade_rostos_camera ?? 0}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <span className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-black ${toneClasses(actionTone)}`}>
                              {row.acao_prevista === "Confirmar Similaridade" ? (
                                <FaCheckCircle />
                              ) : row.acao_prevista === "Confirmar Irregularidade" ? (
                                <FaTimesCircle />
                              ) : row.acao_prevista === "Confirmar Inconclusivo" ? (
                                <FaQuestionCircle />
                              ) : (
                                <FaWrench />
                              )}
                              {row.acao_prevista || "-"}
                            </span>

                            <span className={`inline-flex items-center rounded-full border px-4 py-2 text-sm font-black ${toneClasses(categoryTone)}`}>
                              {row.categoria || "-"}
                            </span>

                            <Link
                              to={`/monitoramento/${row.id}`}
                              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50"
                              title="Abrir laudo"
                            >
                              <FaEllipsisH />
                            </Link>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>

                <div className="flex flex-col gap-3 rounded-[22px] border border-slate-200 bg-white px-4 py-4 shadow-sm md:flex-row md:items-center md:justify-between">
                  <p className="text-sm font-semibold text-slate-600">
                    Mostrando {orderedRows.length ? (currentPage - 1) * PAGE_SIZE + 1 : 0} a {Math.min(currentPage * PAGE_SIZE, orderedRows.length)} de {orderedRows.length} resultados
                  </p>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPage((v) => Math.max(1, v - 1))}
                      disabled={currentPage <= 1}
                      className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <FaChevronLeft /> Anterior
                    </button>
                    <span className="rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-black text-white">{currentPage}</span>
                    <button
                      type="button"
                      onClick={() => setPage((v) => Math.min(totalPages, v + 1))}
                      disabled={currentPage >= totalPages}
                      className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Próxima <FaChevronRight />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
