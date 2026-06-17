import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaCamera,
  FaCheckCircle,
  FaQuestionCircle,
  FaSearch,
  FaTimesCircle,
  FaWrench,
} from "react-icons/fa";
import { supabase } from "../../supabase";
import { InovePageHeader, InoveSection, InoveStatCard } from "../../components/InovePage";

const ACAO_TONE = {
  "Confirmar Similaridade": { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-300", icon: <FaCheckCircle /> },
  "Confirmar Irregularidade": { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-300", icon: <FaTimesCircle /> },
  "Confirmar Inconclusivo": { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-300", icon: <FaQuestionCircle /> },
  "Inconsistência Técnica": { bg: "bg-slate-100", text: "text-slate-600", border: "border-slate-300", icon: <FaWrench /> },
};

function Badge({ acao }) {
  const t = ACAO_TONE[acao] || ACAO_TONE["Inconsistência Técnica"];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-black ${t.bg} ${t.text} ${t.border}`}>
      {t.icon} {acao}
    </span>
  );
}

function ScoreBar({ score }) {
  if (score == null || score < 0) return <span className="text-xs text-slate-400">—</span>;
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

export default function MonitoramentoCentral() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filtroAcao, setFiltroAcao] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("vision_inspecoes")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (!error && data) setRows(data);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    let list = rows;
    if (filtroAcao) list = list.filter((r) => r.acao_prevista === filtroAcao);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (r) =>
          (r.nome || "").toLowerCase().includes(q) ||
          (r.codigo_cartao || "").includes(q) ||
          (r.codigo_usuario || "").includes(q)
      );
    }
    return list;
  }, [rows, filtroAcao, search]);

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

  return (
    <div className="space-y-5 p-4 md:p-6">
      <InovePageHeader
        eyebrow="Vision Web"
        title="Monitoramento de Inspeções"
        description="Laudos de inspeção facial gerados pelo bot de análise automática com Gemini Vision AI."
        icon={<FaCamera className="text-xl" />}
        tone="blue"
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <InoveStatCard title="Similaridade" value={stats.similar} icon={<FaCheckCircle />} tone="emerald" />
        <InoveStatCard title="Irregularidade" value={stats.irregular} icon={<FaTimesCircle />} tone="rose" />
        <InoveStatCard title="Inconclusivo" value={stats.inconclusivo} icon={<FaQuestionCircle />} tone="amber" />
        <InoveStatCard title="Técnica" value={stats.tecnica} icon={<FaWrench />} tone="slate" />
      </div>

      <InoveSection>
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative flex-1">
            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por nome, código do cartão ou usuário..."
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
            <option value="">Todas as ações</option>
            <option value="Confirmar Similaridade">Similaridade</option>
            <option value="Confirmar Irregularidade">Irregularidade</option>
            <option value="Confirmar Inconclusivo">Inconclusivo</option>
            <option value="Inconsistência Técnica">Inconsistência Técnica</option>
          </select>
        </div>

        {loading ? (
          <p className="py-12 text-center text-sm text-slate-400">Carregando laudos...</p>
        ) : filtered.length === 0 ? (
          <p className="py-12 text-center text-sm text-slate-400">Nenhum laudo encontrado.</p>
        ) : (
          <div className="space-y-2">
            {filtered.map((row) => (
              <button
                key={row.id}
                type="button"
                onClick={() => navigate(`/monitoramento/${row.id}`)}
                className="flex w-full items-center gap-4 rounded-2xl border border-slate-100 bg-white px-4 py-3 text-left transition hover:border-blue-200 hover:shadow-sm"
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
                  <p className="text-xs text-slate-500">{row.registro} • {row.data_hora_evento || "—"}</p>
                </div>
                <ScoreBar score={row.score} />
                <Badge acao={row.acao_prevista} />
              </button>
            ))}
          </div>
        )}
      </InoveSection>
    </div>
  );
}
