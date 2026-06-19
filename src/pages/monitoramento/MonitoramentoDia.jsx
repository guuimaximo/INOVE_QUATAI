import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import {
  FaArrowLeft,
  FaCar,
  FaChartBar,
  FaCheckCircle,
  FaChevronDown,
  FaDownload,
  FaFilter,
  FaQuestionCircle,
  FaSearch,
  FaTimesCircle,
  FaWrench,
} from "react-icons/fa";
import * as XLSX from "xlsx";
import { supabase } from "../../supabase";
import { InovePageHeader, InoveSection } from "../../components/InovePage";

const STORAGE_KEY = "inove.monitoramento.dia.filters.v1";

const ACTION_TONES = {
  "Confirmar Similaridade": { tone: "emerald", label: "Similaridade" },
  "Confirmar Irregularidade": { tone: "rose", label: "Irregularidade" },
  "Confirmar Inconclusivo": { tone: "amber", label: "Inconclusivo" },
  "Inconsistencia Tecnica": { tone: "slate", label: "Tecnica" },
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

function readSavedFilters(day) {
  if (typeof window === "undefined" || !day) return {};
  try {
    return JSON.parse(window.localStorage.getItem(`${STORAGE_KEY}:${day}`) || "{}") || {};
  } catch {
    return {};
  }
}

function writeSavedFilters(day, filters) {
  if (typeof window === "undefined" || !day) return;
  try {
    window.localStorage.setItem(`${STORAGE_KEY}:${day}`, JSON.stringify(filters));
  } catch {}
}

function formatDateBR(isoDate) {
  const m = String(isoDate || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : isoDate || "-";
}

function formatDateTimeBR(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (!Number.isNaN(d.getTime())) {
    return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  }
  return String(value);
}

function toneClasses(tone) {
  const map = {
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
    rose: "border-rose-200 bg-rose-50 text-rose-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    slate: "border-slate-200 bg-slate-50 text-slate-700",
    blue: "border-blue-200 bg-blue-50 text-blue-700",
  };
  return map[tone] || map.slate;
}

function CardKPI({ title, value, sub, icon, tone = "blue" }) {
  return (
    <div className={`rounded-3xl border p-4 shadow-sm ${toneClasses(tone)}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.22em] opacity-80">{title}</p>
          <p className="mt-2 text-3xl font-black text-slate-900">{value}</p>
          {sub ? <p className="mt-1 text-xs font-semibold opacity-80">{sub}</p> : null}
        </div>
        {icon ? <div className="text-3xl opacity-80">{icon}</div> : null}
      </div>
    </div>
  );
}

function Badge({ text, tone }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-black ${toneClasses(tone)}`}>
      {text}
    </span>
  );
}

export default function MonitoramentoDia() {
  const navigate = useNavigate();
  const { dia } = useParams();
  const saved = useMemo(() => readSavedFilters(dia), [dia]);

  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(saved.search || "");
  const [acao, setAcao] = useState(saved.acao || "");
  const [categoria, setCategoria] = useState(saved.categoria || "");
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
        "id,dt_evento,created_at,data_hora_evento,nome,registro,prefixo,veiculo,acao_prevista,categoria,score,score_biometrico,similaridade_arcface,quantidade_rostos_camera,img_cadastro_url,img_camera_url,codigo_usuario,codigo_cartao,tipo_cartao,status_inspecao,status_cartao,categoria_biometrica,confianca,confianca_biometrica,decisao_biometrica"
      )
      .eq("dt_evento", dia)
      .order("created_at", { ascending: false });

    const [{ data: summaryData, error: summaryError }, { data: rowsData, error: rowsError }] = await Promise.all([summaryQuery, rowsQuery]);

    if (summaryError || rowsError) {
      const message = summaryError?.message || rowsError?.message || "Nao foi possivel carregar os laudos do dia.";
      setError(message);
      setRows([]);
      setSummary(null);
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
  }, [dia, saved]);

  useEffect(() => {
    writeSavedFilters(dia, { search, acao, categoria });
  }, [dia, search, acao, categoria]);

  const actionOptions = useMemo(
    () =>
      Array.from(new Set(rows.map((row) => row.acao_prevista).filter(Boolean))).sort((a, b) => String(a).localeCompare(String(b))),
    [rows]
  );

  const categoryOptions = useMemo(
    () =>
      Array.from(new Set(rows.map((row) => row.categoria).filter(Boolean))).sort((a, b) => String(a).localeCompare(String(b))),
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

  const kpis = useMemo(
    () => ({
      total: summary?.total_laudos ?? rows.length,
      similaridade: summary?.total_similaridade ?? rows.filter((row) => row.acao_prevista === "Confirmar Similaridade").length,
      irregularidade: summary?.total_irregularidade ?? rows.filter((row) => row.acao_prevista === "Confirmar Irregularidade").length,
      inconclusivo: summary?.total_inconclusivo ?? rows.filter((row) => row.acao_prevista === "Confirmar Inconclusivo").length,
      tecnica: summary?.total_tecnica ?? rows.filter((row) => row.acao_prevista === "Inconsistencia Tecnica").length,
      score: summary?.score_medio ?? "-",
      prefixos: summary?.prefixos_distintos ?? new Set(rows.map((row) => row.prefixo || row.veiculo || row.codigo_cartao || row.codigo_usuario)).size,
    }),
    [summary, rows]
  );

  const exportExcel = () => {
    const sheet = filteredRows.map((row) => ({
      Data: formatDateBR(row.dt_evento),
      "Data/Hora": row.data_hora_evento || formatDateTimeBR(row.created_at),
      Nome: row.nome || "",
      Registro: row.registro || "",
      Prefixo: row.prefixo || row.veiculo || "",
      Ação: row.acao_prevista || "",
      Categoria: row.categoria || "",
      Score: row.score ?? "",
      "Score Biometrico": row.score_biometrico ?? "",
      "ArcFace": row.similaridade_arcface ?? "",
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

  const actionTone = (value) => ACTION_TONES[value]?.tone || "slate";

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-5">
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => navigate("/monitoramento")}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            <FaArrowLeft /> Voltar ao calendário
          </button>
        </div>

        <InovePageHeader
          eyebrow="Monitoramento Vision"
          title={`Laudos do dia ${formatDateBR(dia)}`}
          description="Nesta tela ficam os KPIs consolidados do dia selecionado, com filtros por ação e categoria abaixo e exportação em Excel."
          icon={<FaChartBar className="text-xl" />}
          tone="blue"
          actions={
            <>
              <button
                type="button"
                onClick={exportExcel}
                disabled={!filteredRows.length}
                className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-black text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                <FaDownload /> Baixar Excel
              </button>
            </>
          }
        />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <CardKPI title="Total laudos" value={kpis.total} icon={<FaCalendarAlt />} tone="blue" />
          <CardKPI title="Similaridade" value={kpis.similaridade} icon={<FaCheckCircle />} tone="emerald" />
          <CardKPI title="Irregularidade" value={kpis.irregularidade} icon={<FaTimesCircle />} tone="rose" />
          <CardKPI title="Inconclusivo" value={kpis.inconclusivo} icon={<FaQuestionCircle />} tone="amber" />
          <CardKPI title="Tecnica" value={kpis.tecnica} icon={<FaWrench />} tone="slate" />
          <CardKPI title="Score médio" value={kpis.score ?? "-"} icon={<FaCar />} tone="blue" />
        </div>

        <InoveSection className="overflow-hidden">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_220px_220px_220px]">
            <label className="relative block">
              <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-500">Buscar</span>
              <FaSearch className="pointer-events-none absolute left-4 top-[42px] text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Nome, registro, prefixo, cartão..."
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

            <div className="flex items-end gap-2">
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex h-[50px] items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                <FaFilter /> Limpar filtros
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-600">
              Mostrando {filteredRows.length} de {rows.length}
            </span>
            {acao ? <Badge text={acao} tone={actionTone(acao)} /> : null}
            {categoria ? <Badge text={categoria} tone={CATEGORY_TONES[categoria] || "slate"} /> : null}
            {error ? <span className="rounded-full bg-rose-100 px-3 py-1.5 text-xs font-black text-rose-700">{error}</span> : null}
          </div>
        </InoveSection>

        <InoveSection className="overflow-hidden">
          {loading ? (
            <div className="py-16 text-center text-sm font-bold text-slate-400">Carregando laudos do dia...</div>
          ) : filteredRows.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50/70 py-16 text-center">
              <p className="text-sm font-bold text-slate-700">Nenhum laudo encontrado com os filtros atuais.</p>
              <p className="mt-1 text-sm text-slate-500">Tente limpar os filtros ou revisar o dia selecionado.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-3xl border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-xs font-black uppercase tracking-[0.16em] text-slate-500">Data/Hora</th>
                    <th className="px-4 py-3 text-xs font-black uppercase tracking-[0.16em] text-slate-500">Laudo</th>
                    <th className="px-4 py-3 text-xs font-black uppercase tracking-[0.16em] text-slate-500">Prefixo</th>
                    <th className="px-4 py-3 text-xs font-black uppercase tracking-[0.16em] text-slate-500">Ação</th>
                    <th className="px-4 py-3 text-xs font-black uppercase tracking-[0.16em] text-slate-500">Categoria</th>
                    <th className="px-4 py-3 text-xs font-black uppercase tracking-[0.16em] text-slate-500">Scores</th>
                    <th className="px-4 py-3 text-xs font-black uppercase tracking-[0.16em] text-slate-500">Abrir</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredRows.map((row) => {
                    const actionToneValue = actionTone(row.acao_prevista);
                    const categoryTone = CATEGORY_TONES[row.categoria] || "slate";
                    return (
                      <tr key={row.id} className="transition hover:bg-slate-50">
                        <td className="whitespace-nowrap px-4 py-3 align-top text-xs font-semibold text-slate-500">
                          {formatDateTimeBR(row.data_hora_evento || row.created_at)}
                        </td>
                        <td className="px-4 py-3 align-top">
                          <div className="max-w-[340px]">
                            <p className="truncate font-black text-slate-900">{row.nome || "Sem nome"}</p>
                            <p className="mt-1 text-xs text-slate-500">
                              Registro {row.registro || "-"} {row.codigo_usuario ? `| Usuário ${row.codigo_usuario}` : ""}
                            </p>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 align-top font-bold text-slate-700">
                          {row.prefixo || row.veiculo || "-"}
                        </td>
                        <td className="px-4 py-3 align-top">
                          <Badge text={row.acao_prevista || "-"} tone={actionToneValue} />
                        </td>
                        <td className="px-4 py-3 align-top">
                          <Badge text={row.categoria || "-"} tone={categoryTone} />
                        </td>
                        <td className="px-4 py-3 align-top text-xs font-semibold text-slate-600">
                          <div className="space-y-1">
                            <p>Score: <span className="font-black text-slate-900">{row.score ?? "-"}</span></p>
                            <p>Biometria: <span className="font-black text-slate-900">{row.score_biometrico ?? "-"}</span></p>
                            <p>ArcFace: <span className="font-black text-slate-900">{row.similaridade_arcface ?? "-"}</span></p>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 align-top">
                          <Link
                            to={`/monitoramento/${row.id}`}
                            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 transition hover:bg-slate-50"
                          >
                            Abrir
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </InoveSection>
      </div>
    </div>
  );
}
