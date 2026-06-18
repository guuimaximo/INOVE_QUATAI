import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaCamera,
  FaCheckCircle,
  FaChartBar,
  FaCode,
  FaList,
  FaQuestionCircle,
  FaSearch,
  FaSortAmountDown,
  FaSortAmountUp,
  FaTimesCircle,
  FaTrash,
  FaWrench,
  FaSave,
  FaEdit,
} from "react-icons/fa";
import { supabase } from "../../supabase";
import { InovePageHeader, InoveSection, InoveStatCard } from "../../components/InovePage";

const ACAO_TONE = {
  "Confirmar Similaridade": { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-300", icon: <FaCheckCircle /> },
  "Confirmar Irregularidade": { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-300", icon: <FaTimesCircle /> },
  "Confirmar Inconclusivo": { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-300", icon: <FaQuestionCircle /> },
  "Inconsistencia Tecnica": { bg: "bg-slate-100", text: "text-slate-600", border: "border-slate-300", icon: <FaWrench /> },
};

function Badge({ acao }) {
  const t = ACAO_TONE[acao] || ACAO_TONE["Inconsistencia Tecnica"];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-black ${t.bg} ${t.text} ${t.border}`}>
      {t.icon} {acao}
    </span>
  );
}

function ScoreBar({ score }) {
  if (score == null || score < 0) return <span className="text-xs text-slate-400">-</span>;
  const pct = Math.min(score, 100);
  const color = pct >= 70 ? "bg-emerald-500" : pct >= 40 ? "bg-amber-500" : "bg-rose-500";
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-20 overflow-hidden rounded-full bg-slate-200">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-sm font-black text-slate-700">{score}</span>
    </div>
  );
}

function TabButton({ active, onClick, icon, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition ${
        active ? "bg-blue-600 text-white shadow-md" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
      }`}
    >
      {icon} {label}
    </button>
  );
}

function DashboardTab({ rows }) {
  const stats = useMemo(() => {
    const s = { similar: 0, irregular: 0, inconclusivo: 0, tecnica: 0, total: rows.length };
    const scoreSum = { similar: 0, irregular: 0, inconclusivo: 0 };
    const scoreCnt = { similar: 0, irregular: 0, inconclusivo: 0 };
    const bioCats = {};
    const cameraEnqs = {};
    let facesTotal = 0;
    let facesComValor = 0;

    rows.forEach((r) => {
      const a = r.acao_prevista;
      if (a === "Confirmar Similaridade") {
        s.similar++;
        if (r.score > 0) {
          scoreSum.similar += r.score;
          scoreCnt.similar++;
        }
      } else if (a === "Confirmar Irregularidade") {
        s.irregular++;
        if (r.score > 0) {
          scoreSum.irregular += r.score;
          scoreCnt.irregular++;
        }
      } else if (a === "Confirmar Inconclusivo") {
        s.inconclusivo++;
        if (r.score > 0) {
          scoreSum.inconclusivo += r.score;
          scoreCnt.inconclusivo++;
        }
      } else {
        s.tecnica++;
      }

      const bc = r.categoria_biometrica || "N/A";
      bioCats[bc] = (bioCats[bc] || 0) + 1;

      const ce = r.camera_enquadramento || "N/A";
      cameraEnqs[ce] = (cameraEnqs[ce] || 0) + 1;

      if (r.quantidade_rostos_camera != null) {
        facesTotal += Number(r.quantidade_rostos_camera) || 0;
        facesComValor += 1;
      }
    });

    s.avgSimilar = scoreCnt.similar ? Math.round(scoreSum.similar / scoreCnt.similar) : 0;
    s.avgIrregular = scoreCnt.irregular ? Math.round(scoreSum.irregular / scoreCnt.irregular) : 0;
    s.avgInconclusivo = scoreCnt.inconclusivo ? Math.round(scoreSum.inconclusivo / scoreCnt.inconclusivo) : 0;
    s.facesTotal = facesTotal;
    s.facesMedia = facesComValor ? (facesTotal / facesComValor).toFixed(1) : "0.0";
    s.bioCats = bioCats;
    s.cameraEnqs = cameraEnqs;
    return s;
  }, [rows]);

  const pctSimilar = stats.total ? Math.round((stats.similar / stats.total) * 100) : 0;
  const pctIrregular = stats.total ? Math.round((stats.irregular / stats.total) * 100) : 0;
  const pctInconclusivo = stats.total ? Math.round((stats.inconclusivo / stats.total) * 100) : 0;
  const AVG_COLOR = {
    emerald: "text-emerald-600",
    rose: "text-rose-600",
    amber: "text-amber-600",
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <InoveStatCard title="Similaridade" value={`${stats.similar} (${pctSimilar}%)`} icon={<FaCheckCircle />} tone="emerald" />
        <InoveStatCard title="Irregularidade" value={`${stats.irregular} (${pctIrregular}%)`} icon={<FaTimesCircle />} tone="rose" />
        <InoveStatCard title="Inconclusivo" value={`${stats.inconclusivo} (${pctInconclusivo}%)`} icon={<FaQuestionCircle />} tone="amber" />
        <InoveStatCard title="Erro Tecnico" value={stats.tecnica} icon={<FaWrench />} tone="slate" />
        <InoveStatCard title="Rostos na Camera" value={`${stats.facesTotal} total | media ${stats.facesMedia}`} icon={<FaCamera />} tone="indigo" />
      </div>

      <InoveSection>
        <h3 className="mb-3 text-sm font-black uppercase tracking-widest text-slate-500">Score Medio por Categoria</h3>
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Similaridade", avg: stats.avgSimilar, color: "emerald" },
            { label: "Irregularidade", avg: stats.avgIrregular, color: "rose" },
            { label: "Inconclusivo", avg: stats.avgInconclusivo, color: "amber" },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl border border-slate-100 bg-white p-4 text-center">
              <p className="text-xs font-bold text-slate-500">{s.label}</p>
              <p className={`mt-1 text-3xl font-black ${AVG_COLOR[s.color] || "text-slate-600"}`}>{s.avg}</p>
            </div>
          ))}
        </div>
      </InoveSection>

      <div className="grid gap-4 md:grid-cols-2">
        <InoveSection>
          <h3 className="mb-3 text-sm font-black uppercase tracking-widest text-slate-500">Biometria ArcFace</h3>
          <div className="space-y-1.5">
            {Object.entries(stats.bioCats)
              .sort((a, b) => b[1] - a[1])
              .map(([cat, cnt]) => (
                <div key={cat} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
                  <span className="text-xs font-bold text-slate-600">{cat}</span>
                  <span className="text-sm font-black text-slate-800">{cnt}</span>
                </div>
              ))}
          </div>
        </InoveSection>
        <InoveSection>
          <h3 className="mb-3 text-sm font-black uppercase tracking-widest text-slate-500">Enquadramento da Camera</h3>
          <div className="space-y-1.5">
            {Object.entries(stats.cameraEnqs)
              .sort((a, b) => b[1] - a[1])
              .map(([cat, cnt]) => (
                <div key={cat} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
                  <span className="text-xs font-bold text-slate-600">{cat}</span>
                  <span className="text-sm font-black text-slate-800">{cnt}</span>
                </div>
              ))}
          </div>
        </InoveSection>
      </div>
    </div>
  );
}

function PromptTab() {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase.from("vision_config").select("valor").eq("chave", "prompt_gemini").single();
      if (data?.valor) setPrompt(data.valor);
      else setPrompt("(Prompt ainda nao salvo no banco. Execute o bot ou salve manualmente.)");
      setLoading(false);
    })();
  }, []);

  const salvar = async () => {
    setSaving(true);
    const { data: existing } = await supabase.from("vision_config").select("id").eq("chave", "prompt_gemini").single();

    if (existing) {
      await supabase.from("vision_config").update({ valor: prompt, updated_at: new Date().toISOString() }).eq("chave", "prompt_gemini");
    } else {
      await supabase.from("vision_config").insert({ chave: "prompt_gemini", valor: prompt });
    }
    setSaving(false);
    setEditing(false);
  };

  if (loading) return <p className="py-12 text-center text-sm text-slate-400">Carregando prompt...</p>;

  return (
    <InoveSection>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-black uppercase tracking-widest text-slate-500">Prompt Gemini Vision</h3>
        <div className="flex gap-2">
          {editing ? (
            <button
              onClick={salvar}
              disabled={saving}
              className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              <FaSave /> {saving ? "Salvando..." : "Salvar"}
            </button>
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700"
            >
              <FaEdit /> Editar
            </button>
          )}
        </div>
      </div>
      {editing ? (
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={28}
          className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 font-mono text-xs leading-relaxed text-slate-700 outline-none focus:border-blue-400 focus:bg-white"
        />
      ) : (
        <pre className="max-h-[70vh] overflow-auto whitespace-pre-wrap rounded-2xl bg-slate-50 p-4 font-mono text-xs leading-relaxed text-slate-700">
          {prompt}
        </pre>
      )}
    </InoveSection>
  );
}

export default function MonitoramentoCentral() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filtroAcao, setFiltroAcao] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("");
  const [sortField, setSortField] = useState("created_at");
  const [sortAsc, setSortAsc] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [tab, setTab] = useState("laudos");
  const [deleting, setDeleting] = useState(false);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from("vision_inspecoes").select("*").order("created_at", { ascending: false }).limit(1000);
    if (!error && data) setRows(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const filtered = useMemo(() => {
    let list = rows;
    if (filtroAcao) list = list.filter((r) => r.acao_prevista === filtroAcao);
    if (filtroCategoria) list = list.filter((r) => r.categoria === filtroCategoria);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (r) =>
          (r.nome || "").toLowerCase().includes(q) ||
          (r.codigo_cartao || "").includes(q) ||
          (r.codigo_usuario || "").includes(q) ||
          (r.registro || "").includes(q)
      );
    }
    list = [...list].sort((a, b) => {
      const va = a[sortField] ?? "";
      const vb = b[sortField] ?? "";
      if (typeof va === "number" && typeof vb === "number") return sortAsc ? va - vb : vb - va;
      return sortAsc ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
    });
    return list;
  }, [rows, filtroAcao, filtroCategoria, search, sortField, sortAsc]);

  const stats = useMemo(() => {
    const s = { similar: 0, irregular: 0, inconclusivo: 0, tecnica: 0 };
    rows.forEach((r) => {
      if (r.acao_prevista === "Confirmar Similaridade") s.similar++;
      else if (r.acao_prevista === "Confirmar Irregularidade") s.irregular++;
      else if (r.acao_prevista === "Confirmar Inconclusivo") s.inconclusivo++;
      else s.tecnica++;
    });
    return s;
  }, [rows]);

  const toggleSort = (field) => {
    if (sortField === field) setSortAsc(!sortAsc);
    else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const toggleSelect = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((r) => r.id)));
  };

  const excluirSelecionados = async () => {
    if (!selected.size) return;
    if (!window.confirm(`Excluir ${selected.size} laudo(s)?`)) return;
    setDeleting(true);
    const ids = Array.from(selected);
    await supabase.from("vision_inspecoes").delete().in("id", ids);
    setSelected(new Set());
    await fetchRows();
    setDeleting(false);
  };

  const SortIcon = sortAsc ? FaSortAmountUp : FaSortAmountDown;

  return (
    <div className="space-y-5 p-4 md:p-6">
      <InovePageHeader
        eyebrow="Vision Web"
        title="Monitoramento de Inspecoes"
        description="Laudos de inspecao facial gerados pelo bot de analise automatica com Gemini Vision AI, InsightFace/ArcFace e Face Mesh."
        icon={<FaCamera className="text-xl" />}
        tone="blue"
      />

      <div className="flex gap-2">
        <TabButton active={tab === "dashboard"} onClick={() => setTab("dashboard")} icon={<FaChartBar />} label="Dashboard" />
        <TabButton active={tab === "laudos"} onClick={() => setTab("laudos")} icon={<FaList />} label="Laudos" />
        <TabButton active={tab === "prompt"} onClick={() => setTab("prompt")} icon={<FaCode />} label="Prompt Gemini" />
      </div>

      {tab === "dashboard" && <DashboardTab rows={rows} />}
      {tab === "prompt" && <PromptTab />}

      {tab === "laudos" && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <InoveStatCard title="Similaridade" value={stats.similar} icon={<FaCheckCircle />} tone="emerald" />
            <InoveStatCard title="Irregularidade" value={stats.irregular} icon={<FaTimesCircle />} tone="rose" />
            <InoveStatCard title="Inconclusivo" value={stats.inconclusivo} icon={<FaQuestionCircle />} tone="amber" />
            <InoveStatCard title="Tecnica" value={stats.tecnica} icon={<FaWrench />} tone="slate" />
          </div>

          <InoveSection>
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center">
              <div className="relative flex-1">
                <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar por nome, cartao, usuario ou registro..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-3 text-sm font-semibold outline-none transition focus:border-blue-400 focus:bg-white"
                />
              </div>
              <select
                value={filtroAcao}
                onChange={(e) => setFiltroAcao(e.target.value)}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold outline-none"
              >
                <option value="">Todas as acoes</option>
                <option value="Confirmar Similaridade">Similaridade</option>
                <option value="Confirmar Irregularidade">Irregularidade</option>
                <option value="Confirmar Inconclusivo">Inconclusivo</option>
                <option value="Inconsistencia Tecnica">Inconsistencia Tecnica</option>
              </select>
              <select
                value={filtroCategoria}
                onChange={(e) => setFiltroCategoria(e.target.value)}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold outline-none"
              >
                <option value="">Todas categorias</option>
                <option value="PESSOA_VISIVEL_SIMILAR">Similar</option>
                <option value="PESSOA_VISIVEL_DIFERENTE">Diferente</option>
                <option value="SEM_PESSOA">Sem Pessoa</option>
                <option value="INCONCLUSIVO">Inconclusivo</option>
                <option value="ERRO">Erro</option>
              </select>
            </div>

            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-500">Ordenar:</span>
              {[
                { field: "created_at", label: "Data" },
                { field: "score", label: "Score" },
                { field: "score_biometrico", label: "Biometria" },
                { field: "nome", label: "Nome" },
              ].map((s) => (
                <button
                  key={s.field}
                  onClick={() => toggleSort(s.field)}
                  className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold transition ${
                    sortField === s.field ? "bg-blue-100 text-blue-700" : "bg-slate-50 text-slate-500 hover:bg-slate-100"
                  }`}
                >
                  {s.label} {sortField === s.field && <SortIcon className="text-[10px]" />}
                </button>
              ))}

              {selected.size > 0 && (
                <button
                  onClick={excluirSelecionados}
                  disabled={deleting}
                  className="ml-auto flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-50"
                >
                  <FaTrash /> {deleting ? "Excluindo..." : `Excluir (${selected.size})`}
                </button>
              )}
            </div>

            {loading ? (
              <p className="py-12 text-center text-sm text-slate-400">Carregando laudos...</p>
            ) : filtered.length === 0 ? (
              <p className="py-12 text-center text-sm text-slate-400">Nenhum laudo encontrado.</p>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2 px-2 pb-1">
                  <input
                    type="checkbox"
                    checked={selected.size === filtered.length && filtered.length > 0}
                    onChange={selectAll}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  <span className="text-xs text-slate-400">{filtered.length} laudos</span>
                </div>
                {filtered.map((row) => (
                  <div
                    key={row.id}
                    className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white px-4 py-3 transition hover:border-blue-200 hover:shadow-sm"
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(row.id)}
                      onChange={() => toggleSelect(row.id)}
                      className="h-4 w-4 flex-shrink-0 rounded border-slate-300"
                    />
                    <button
                      type="button"
                      onClick={() => navigate(`/monitoramento/${row.id}`)}
                      className="flex min-w-0 flex-1 items-center gap-4 text-left"
                    >
                      {row.img_cadastro_url ? (
                        <img src={row.img_cadastro_url} alt="" className="h-14 w-14 rounded-xl border object-cover" />
                      ) : (
                        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
                          <FaCamera />
                        </div>
                      )}
                      {row.img_camera_url ? (
                        <img src={row.img_camera_url} alt="" className="h-14 w-14 rounded-xl border object-cover" />
                      ) : (
                        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
                          <FaCamera />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-black text-slate-900">{row.nome || "Sem nome"}</p>
                        <p className="text-xs text-slate-500">
                          {row.registro} &bull; {row.data_hora_evento || "-"}
                        </p>
                        {row.quantidade_rostos_camera != null && (
                          <p className="text-xs text-slate-500">Rostos na camera: {row.quantidade_rostos_camera}</p>
                        )}
                        {row.score_biometrico != null && (
                          <p className="text-xs text-blue-500">
                            Bio: {row.score_biometrico} &bull; ArcFace: {row.similaridade_arcface ?? "-"}
                          </p>
                        )}
                      </div>
                      <ScoreBar score={row.score} />
                      <Badge acao={row.acao_prevista} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </InoveSection>
        </>
      )}
    </div>
  );
}
