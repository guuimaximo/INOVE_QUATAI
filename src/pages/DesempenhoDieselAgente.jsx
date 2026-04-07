import React, { useMemo, useState, useEffect, useRef, useCallback } from "react";
import {
  FaBolt,
  FaCheckCircle,
  FaExclamationTriangle,
  FaPlay,
  FaFilePdf,
  FaSync,
  FaSort,
  FaSortUp,
  FaSortDown,
  FaTimes,
  FaListAlt,
  FaSearch,
  FaTrophy,
  FaUsers,
  FaLayerGroup,
  FaFolderOpen,
  FaFilter,
  FaCalendarAlt,
} from "react-icons/fa";
import { supabase } from "../supabase";
import { supabaseBCNT } from "../supabaseBCNT";

const GH_USER = import.meta.env.VITE_GITHUB_USER;
const GH_REPO = import.meta.env.VITE_GITHUB_REPO;
const GH_TOKEN = import.meta.env.VITE_GITHUB_TOKEN;
const GH_REF = "main";

const WF_GERENCIAL = "relatorio_gerencial.yml";
const WF_ACOMP = "ordem-acompanhamento.yml";
const WF_PARCIAL = "parcial-meritocracia.yml"; // ajuste aqui se o nome real do arquivo for outro

const SUPABASE_BASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_BCNT_BASE_URL = import.meta.env.VITE_SUPA_BASE_BCNT_URL;
const BUCKET_RELATORIOS = "relatorios";
const BUCKET_PARCIAL = "parcial_meritocracia";

function clsx(...arr) {
  return arr.filter(Boolean).join(" ");
}

function n(v) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function fmtDateInput(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function fmtMesAtual(d = new Date()) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${yyyy}-${mm}`;
}

function fmtBRDate(v) {
  if (!v) return "-";
  const dt = new Date(v);
  if (Number.isNaN(dt.getTime())) return "-";
  return dt.toLocaleDateString("pt-BR");
}

function fmtBRDateTime(v) {
  if (!v) return "-";
  const dt = new Date(v);
  if (Number.isNaN(dt.getTime())) return "-";
  return dt.toLocaleString("pt-BR");
}

function getPublicUrl(bucket, path, baseUrl = SUPABASE_BASE_URL) {
  if (!path) return null;
  if (path.startsWith("http")) return path;

  try {
    if (bucket === BUCKET_PARCIAL) {
      const { data } = supabaseBCNT.storage.from(bucket).getPublicUrl(path);
      if (data?.publicUrl) return data.publicUrl;
    }

    const cleanPath = path.startsWith("/") ? path.slice(1) : path;
    return `${baseUrl}/storage/v1/object/public/${bucket}/${cleanPath}`;
  } catch {
    const cleanPath = path.startsWith("/") ? path.slice(1) : path;
    return `${baseUrl}/storage/v1/object/public/${bucket}/${cleanPath}`;
  }
}

function extractChapaFromName(name = "") {
  const m = String(name).match(/^\d{3}_(\d+)_/);
  return m?.[1] || "";
}

function extractNomeFromName(name = "", mesRef = "") {
  const base = String(name).replace(/\.pdf$/i, "");
  const semPrefixo = base.replace(/^\d{3}_\d+_/, "");
  const semMes = mesRef ? semPrefixo.replace(new RegExp(`_${mesRef}$`), "") : semPrefixo;
  return semMes.replaceAll("_", " ").trim();
}

function normalizeFileName(name = "") {
  return String(name || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\.pdf$/i, "")
    .trim()
    .toUpperCase();
}

function isPdfFile(file) {
  return !!file?.name && String(file.name).toLowerCase().endsWith(".pdf");
}

function isConsolidadoFile(name = "") {
  const n = normalizeFileName(name);
  return n.includes("CONSOLIDADO");
}

function isResumoFile(name = "") {
  const n = normalizeFileName(name);
  return n.includes("RESUMO");
}

function buildIndividualFallbackItems(mesRef = "") {
  if (mesRef !== "2026-04") return [];

  const directUrl = `https://jqolpjupgijjyrkaoxud.supabase.co/storage/v1/object/public/parcial_meritocracia/${mesRef}/individuais/001_30002393_30002393_${mesRef}.pdf`;
  const fileName = `001_30002393_30002393_${mesRef}.pdf`;

  return [
    {
      fileName,
      path: `${mesRef}/individuais/${fileName}`,
      chapa: "30002393",
      nome: "30002393",
      publicUrl: directUrl,
      updated_at: null,
      fallback: true,
    },
  ];
}

async function dispatchGitHubWorkflow(workflowFile, inputs) {
  if (!GH_USER || !GH_REPO || !GH_TOKEN) throw new Error("Credenciais GitHub ausentes.");

  const url = `https://api.github.com/repos/${GH_USER}/${GH_REPO}/actions/workflows/${workflowFile}/dispatches`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${GH_TOKEN}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ref: GH_REF, inputs }),
  });

  if (response.status !== 204) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.message || `Erro GitHub: ${response.status}`);
  }

  return true;
}

function StatusBadge({ status }) {
  if (status === "CONCLUIDO") {
    return <span className="px-2 py-1 rounded text-xs font-bold bg-emerald-100 text-emerald-700">OK</span>;
  }
  if (status === "ERRO") {
    return <span className="px-2 py-1 rounded text-xs font-bold bg-rose-100 text-rose-700">ERRO</span>;
  }
  return <span className="px-2 py-1 rounded text-xs font-bold bg-amber-100 text-amber-700">{status || "PROCESSANDO"}</span>;
}

function TabButton({ active, icon: Icon, title, subtitle, onClick }) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "flex items-start gap-3 rounded-2xl border p-4 text-left transition-all w-full",
        active
          ? "border-cyan-500 bg-cyan-50 shadow-sm"
          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
      )}
    >
      <div
        className={clsx(
          "h-11 w-11 rounded-xl flex items-center justify-center shrink-0",
          active ? "bg-cyan-600 text-white" : "bg-slate-100 text-slate-600"
        )}
      >
        <Icon size={18} />
      </div>
      <div>
        <div className={clsx("font-bold text-sm", active ? "text-cyan-800" : "text-slate-800")}>{title}</div>
        <div className="text-xs text-slate-500 mt-1">{subtitle}</div>
      </div>
    </button>
  );
}

function CardResumo({ icon: Icon, titulo, valor, subtitulo, tone = "slate" }) {
  const tones = {
    slate: "bg-white border-slate-200 text-slate-800",
    cyan: "bg-cyan-50 border-cyan-200 text-cyan-900",
    amber: "bg-amber-50 border-amber-200 text-amber-900",
    emerald: "bg-emerald-50 border-emerald-200 text-emerald-900",
    rose: "bg-rose-50 border-rose-200 text-rose-900",
  };

  return (
    <div className={clsx("rounded-2xl border p-4 shadow-sm", tones[tone] || tones.slate)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-bold uppercase tracking-wide opacity-70">{titulo}</div>
          <div className="text-2xl font-black mt-2">{valor}</div>
          {subtitulo ? <div className="text-xs mt-2 opacity-80">{subtitulo}</div> : null}
        </div>
        <div className="h-10 w-10 rounded-xl bg-white/70 border flex items-center justify-center">
          <Icon size={16} />
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ title, description, right }) {
  return (
    <div className="flex items-center justify-between gap-4 flex-wrap">
      <div>
        <h3 className="text-lg font-black text-slate-800">{title}</h3>
        {description ? <p className="text-sm text-slate-500 mt-1">{description}</p> : null}
      </div>
      {right}
    </div>
  );
}

function SimpleLineChart({ data }) {
  if (!data || data.length === 0) {
    return <div className="text-center text-xs text-slate-400 py-10">Sem dados gráficos disponíveis</div>;
  }

  const width = 500;
  const height = 180;
  const padding = 30;

  const allValues = data.flatMap((d) => [n(d.real), n(d.meta)]);
  const maxVal = (Math.max(...allValues) || 5) * 1.05;
  const minVal = (Math.min(...allValues) || 0) * 0.95;
  const range = maxVal - minVal || 1;

  const getX = (i) => padding + (i / Math.max(1, data.length - 1)) * (width - 2 * padding);
  const getY = (val) => height - padding - ((val - minVal) / range) * (height - 2 * padding);

  const pointsReal = data.map((d, i) => `${getX(i)},${getY(n(d.real))}`).join(" ");
  const pointsMeta = data.map((d, i) => `${getX(i)},${getY(n(d.meta))}`).join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto border bg-white rounded-lg font-sans">
      {[0, 0.5, 1].map((pct, i) => {
        const y = height - padding - pct * (height - 2 * padding);
        return <line key={i} x1={padding} y1={y} x2={width - padding} y2={y} stroke="#f1f5f9" strokeWidth="1" />;
      })}

      <polyline fill="none" stroke="#94a3b8" strokeWidth="2" strokeDasharray="4,4" points={pointsMeta} />
      <polyline fill="none" stroke="#dc2626" strokeWidth="2" points={pointsReal} />

      {data.map((d, i) => (
        <g key={i}>
          <circle cx={getX(i)} cy={getY(n(d.real))} r="3" fill="#dc2626" />
          <text x={getX(i)} y={getY(n(d.real)) - 10} textAnchor="middle" fontSize="10" fill="#dc2626" fontWeight="bold">
            {n(d.real).toFixed(2)}
          </text>
          <text x={getX(i)} y={getY(n(d.meta)) + 15} textAnchor="middle" fontSize="9" fill="#64748b">
            Ref: {n(d.meta).toFixed(2)}
          </text>
          <text x={getX(i)} y={height - 8} textAnchor="middle" fontSize="10" fill="#475569" fontWeight="500">
            {d.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

function ThSortable({ label, columnKey, sortConfig, onSort, align = "left" }) {
  const isActive = sortConfig.key === columnKey;
  return (
    <th className={`p-3 cursor-pointer hover:bg-slate-100 text-${align}`} onClick={() => onSort(columnKey)}>
      <div className={`flex items-center gap-1 ${align === "right" ? "justify-end" : "justify-start"}`}>
        {label}
        {!isActive ? (
          <FaSort className="text-slate-300" />
        ) : sortConfig.direction === "asc" ? (
          <FaSortUp className="text-cyan-600" />
        ) : (
          <FaSortDown className="text-cyan-600" />
        )}
      </div>
    </th>
  );
}

function IndividualParcialTable({ items, busca, setBusca, mesRef }) {
  const [sortConfig, setSortConfig] = useState({ key: "nome", direction: "asc" });

  const filtrados = useMemo(() => {
    const q = String(busca || "").toLowerCase().trim();
    return (items || []).filter((item) => {
      if (!q) return true;
      return (
        String(item.nome || "").toLowerCase().includes(q) ||
        String(item.chapa || "").toLowerCase().includes(q) ||
        String(item.fileName || "").toLowerCase().includes(q)
      );
    });
  }, [items, busca]);

  const ordenados = useMemo(() => {
    const arr = [...filtrados];
    arr.sort((a, b) => {
      let av = a[sortConfig.key];
      let bv = b[sortConfig.key];
      av = String(av || "").toLowerCase();
      bv = String(bv || "").toLowerCase();
      if (av < bv) return sortConfig.direction === "asc" ? -1 : 1;
      if (av > bv) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });
    return arr;
  }, [filtrados, sortConfig]);

  const onSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  return (
    <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
      <div className="p-4 border-b bg-slate-50 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="font-extrabold text-slate-800">Parciais Individuais</div>
          <div className="text-xs text-slate-500 mt-1">Busca rápida por chapa ou motorista no mês {mesRef}.</div>
        </div>
        <div className="w-full md:w-96 relative">
          <FaSearch className="absolute left-3 top-3.5 text-slate-400" />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar motorista ou chapa..."
            className="w-full border rounded-xl pl-10 pr-4 py-3 text-sm"
          />
        </div>
      </div>

      <div className="overflow-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100 text-slate-700">
            <tr>
              <ThSortable label="Chapa" columnKey="chapa" sortConfig={sortConfig} onSort={onSort} />
              <ThSortable label="Motorista" columnKey="nome" sortConfig={sortConfig} onSort={onSort} />
              <ThSortable label="Arquivo" columnKey="fileName" sortConfig={sortConfig} onSort={onSort} />
              <th className="p-3 text-right">Ação</th>
            </tr>
          </thead>
          <tbody>
            {ordenados.map((item) => (
              <tr key={item.path} className="border-t hover:bg-slate-50">
                <td className="p-3 font-bold text-slate-700">{item.chapa || "-"}</td>
                <td className="p-3">{item.nome || "-"}</td>
                <td className="p-3 text-slate-500">{item.fileName}</td>
                <td className="p-3 text-right">
                  <a
                    href={item.publicUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 text-white px-3 py-2 font-bold hover:bg-cyan-700"
                  >
                    <FaFilePdf /> Abrir PDF
                  </a>
                </td>
              </tr>
            ))}

            {ordenados.length === 0 && (
              <tr>
                <td colSpan={4} className="p-8 text-center text-slate-500 font-medium">
                  Nenhuma parcial individual encontrada para o filtro informado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ParcialMeritocraciaView({ onAlert }) {
  const [mesRef, setMesRef] = useState(fmtMesAtual());
  const [loading, setLoading] = useState(false);
  const [loadingGeracao, setLoadingGeracao] = useState(false);
  const [subTab, setSubTab] = useState("individual");
  const [buscaIndividual, setBuscaIndividual] = useState("");

  const [individuais, setIndividuais] = useState([]);
  const [consolidado, setConsolidado] = useState(null);
  const [resumo, setResumo] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [arquivosRaiz, setArquivosRaiz] = useState([]);
  const [debugStorage, setDebugStorage] = useState({ root: [], individuais: [], pathRoot: "", pathIndividuais: "" });

  const carregarArquivos = useCallback(async () => {
    setLoading(true);
    try {
      const rootCandidates = [mesRef, `${mesRef}/`, `/${mesRef}`, mesRef.trim()];
      const indCandidates = [`${mesRef}/individuais`, `${mesRef}/individuais/`, `/${mesRef}/individuais`, `${mesRef.trim()}/individuais`];

      let rootData = [];
      let indData = [];
      let rootPathUsed = "";
      let indPathUsed = "";
      let lastError = null;

      for (const p of rootCandidates) {
        const resp = await supabaseBCNT.storage.from(BUCKET_PARCIAL).list(p, {
          limit: 500,
          offset: 0,
          sortBy: { column: "name", order: "asc" },
        });

        if (!resp.error && Array.isArray(resp.data) && resp.data.length > 0) {
          rootData = resp.data;
          rootPathUsed = p;
          break;
        }

        if (resp.error) lastError = resp.error;
      }

      for (const p of indCandidates) {
        const resp = await supabaseBCNT.storage.from(BUCKET_PARCIAL).list(p, {
          limit: 1000,
          offset: 0,
          sortBy: { column: "name", order: "asc" },
        });

        if (!resp.error && Array.isArray(resp.data) && resp.data.length > 0) {
          indData = resp.data;
          indPathUsed = p;
          break;
        }

        if (resp.error) lastError = resp.error;
      }

      if (!rootData.length && !indData.length) {
        const fallbackRoot = await supabaseBCNT.storage.from(BUCKET_PARCIAL).list("", {
          limit: 500,
          offset: 0,
          sortBy: { column: "name", order: "asc" },
        });

        if (fallbackRoot.error && lastError) throw lastError;

        const pastaMes = (fallbackRoot.data || []).find((f) => String(f.name || "") === mesRef);
        if (pastaMes) {
          rootPathUsed = mesRef;
          const retryRoot = await supabaseBCNT.storage.from(BUCKET_PARCIAL).list(mesRef, {
            limit: 500,
            offset: 0,
            sortBy: { column: "name", order: "asc" },
          });
          if (!retryRoot.error) rootData = retryRoot.data || [];

          const retryInd = await supabaseBCNT.storage.from(BUCKET_PARCIAL).list(`${mesRef}/individuais`, {
            limit: 1000,
            offset: 0,
            sortBy: { column: "name", order: "asc" },
          });
          if (!retryInd.error) {
            indData = retryInd.data || [];
            indPathUsed = `${mesRef}/individuais`;
          }
        }

        setDebugStorage({
          root: (fallbackRoot.data || []).map((f) => f.name),
          individuais: [],
          pathRoot: rootPathUsed || "[raiz bucket]",
          pathIndividuais: indPathUsed || "[não encontrado]",
        });
      }

      let indFiles = (indData || [])
        .filter((f) => isPdfFile(f))
        .map((f) => {
          const cleanBase = (indPathUsed || `${mesRef}/individuais`).replace(/^\//, "").replace(/\/$/, "");
          const path = `${cleanBase}/${f.name}`;
          return {
            fileName: f.name,
            path,
            chapa: extractChapaFromName(f.name),
            nome: extractNomeFromName(f.name, mesRef),
            publicUrl: getPublicUrl(BUCKET_PARCIAL, path, SUPABASE_BCNT_BASE_URL),
            updated_at: f.updated_at || f.created_at || null,
          };
        });

      if (!indFiles.length) {
        indFiles = buildIndividualFallbackItems(mesRef);
      }

      const rootFiles = (rootData || []).filter((f) => isPdfFile(f));
      const consolidadoFile = rootFiles.find((f) => isConsolidadoFile(f.name));
      const resumoFile = rootFiles.find((f) => isResumoFile(f.name));
      const cleanRootBase = (rootPathUsed || mesRef).replace(/^\//, "").replace(/\/$/, "");

      setDebugStorage({
        root: (rootData || []).map((f) => f.name),
        individuais: indFiles.length ? indFiles.map((f) => f.fileName) : (indData || []).map((f) => f.name),
        pathRoot: rootPathUsed || "[não encontrado]",
        pathIndividuais: indPathUsed || "[não encontrado]",
      });

      setArquivosRaiz(rootFiles.map((f) => f.name));
      setIndividuais(indFiles);
      setConsolidado(
        consolidadoFile
          ? {
              fileName: consolidadoFile.name,
              path: `${cleanRootBase}/${consolidadoFile.name}`,
              publicUrl: getPublicUrl(BUCKET_PARCIAL, `${cleanRootBase}/${consolidadoFile.name}`, SUPABASE_BCNT_BASE_URL),
              updated_at: consolidadoFile.updated_at || consolidadoFile.created_at || null,
            }
          : null
      );
      setResumo(
        resumoFile
          ? {
              fileName: resumoFile.name,
              path: `${cleanRootBase}/${resumoFile.name}`,
              publicUrl: getPublicUrl(BUCKET_PARCIAL, `${cleanRootBase}/${resumoFile.name}`, SUPABASE_BCNT_BASE_URL),
              updated_at: resumoFile.updated_at || resumoFile.created_at || null,
            }
          : null
      );
      setLastUpdated(new Date().toISOString());
    } catch (e) {
      onAlert?.({ type: "error", message: `Erro ao carregar parciais: ${e?.message || String(e)}` });
    } finally {
      setLoading(false);
    }
  }, [mesRef, onAlert]);

  useEffect(() => {
    carregarArquivos();
  }, [carregarArquivos]);

  const dispararParcial = async () => {
    if (loadingGeracao) return;
    setLoadingGeracao(true);
    try {
      await dispatchGitHubWorkflow(WF_PARCIAL, { mes_referencia: mesRef });
      onAlert?.({ type: "success", message: `Parcial de Meritocracia do mês ${mesRef} enviada para processamento.` });
      setTimeout(() => {
        carregarArquivos();
      }, 2500);
    } catch (e) {
      onAlert?.({ type: "error", message: e?.message || String(e) });
    } finally {
      setLoadingGeracao(false);
    }
  };

  const totalIndividuais = individuais.length;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border shadow-sm p-5 space-y-5">
        <SectionHeader
          title="Parcial de Meritocracia"
          description="Central mensal para geração e consulta dos PDFs individuais, consolidado de motoristas e resumo geral."
          right={
            <button onClick={carregarArquivos} className="p-2 text-slate-500 hover:bg-slate-100 rounded-full" title="Atualizar arquivos">
              <FaSync className={clsx(loading && "animate-spin")} />
            </button>
          }
        />

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div className="md:col-span-1">
            <label className="text-xs font-bold text-slate-500 flex items-center gap-2 mb-2">
              <FaCalendarAlt /> Mês de referência
            </label>
            <input
              type="month"
              value={mesRef}
              onChange={(e) => setMesRef(e.target.value)}
              className="w-full border rounded-xl px-3 py-3 text-sm"
            />
          </div>

          <div className="md:col-span-3 flex items-center gap-3 flex-wrap">
            <button
              onClick={dispararParcial}
              disabled={!mesRef || loadingGeracao}
              className={clsx(
                "px-5 py-3 rounded-xl font-extrabold text-sm inline-flex items-center gap-2 transition-colors",
                !mesRef || loadingGeracao ? "bg-slate-200 text-slate-400" : "bg-amber-500 text-white hover:bg-amber-600"
              )}
            >
              <FaPlay className={clsx(loadingGeracao && "animate-spin")} />
              {loadingGeracao ? "ENVIANDO..." : "GERAR PARCIAL DO MÊS"}
            </button>

            <div className="text-xs text-slate-500">
              Última atualização local: <span className="font-bold text-slate-700">{lastUpdated ? fmtBRDateTime(lastUpdated) : "-"}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <CardResumo
          icon={FaUsers}
          titulo="Parciais Individuais"
          valor={String(totalIndividuais)}
          subtitulo="Arquivos de motoristas encontrados no mês"
          tone="cyan"
        />
        <CardResumo
          icon={FaLayerGroup}
          titulo="Consolidado"
          valor={consolidado ? "Disponível" : "Pendente"}
          subtitulo={consolidado?.updated_at ? `Atualizado em ${fmtBRDateTime(consolidado.updated_at)}` : "Arquivo único com todos os motoristas"}
          tone={consolidado ? "emerald" : "amber"}
        />
        <CardResumo
          icon={FaTrophy}
          titulo="Resumo das Parciais"
          valor={resumo ? "Disponível" : "Pendente"}
          subtitulo={resumo?.updated_at ? `Atualizado em ${fmtBRDateTime(resumo.updated_at)}` : "Visão executiva consolidada do mês"}
          tone={resumo ? "emerald" : "amber"}
        />
      </div>

      <div className="bg-white rounded-2xl border shadow-sm p-2">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <button
            onClick={() => setSubTab("individual")}
            className={clsx(
              "rounded-xl px-4 py-3 font-bold text-sm",
              subTab === "individual" ? "bg-cyan-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            )}
          >
            PARCIAL INDIVIDUAL
          </button>
          <button
            onClick={() => setSubTab("consolidado")}
            className={clsx(
              "rounded-xl px-4 py-3 font-bold text-sm",
              subTab === "consolidado" ? "bg-cyan-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            )}
          >
            PARCIAL CONSOLIDADO
          </button>
          <button
            onClick={() => setSubTab("resumo")}
            className={clsx(
              "rounded-xl px-4 py-3 font-bold text-sm",
              subTab === "resumo" ? "bg-cyan-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            )}
          >
            RESUMO PARCIAIS
          </button>
        </div>
      </div>

      {subTab === "individual" && (
        <IndividualParcialTable items={individuais} busca={buscaIndividual} setBusca={setBuscaIndividual} mesRef={mesRef} />
      )}

      {subTab === "consolidado" && (
        <div className="bg-white rounded-2xl border shadow-sm p-6">
          <SectionHeader
            title="Parcial Consolidado"
            description="Arquivo consolidado com a união das parciais individuais do mês selecionado."
          />

          <div className="mt-5 rounded-2xl border bg-slate-50 p-5 flex items-center justify-between gap-4 flex-wrap">
            <div>
              <div className="text-sm font-bold text-slate-800">{consolidado?.fileName || "Arquivo ainda não disponível"}</div>
              <div className="text-xs text-slate-500 mt-1">
                {consolidado?.updated_at ? `Atualizado em ${fmtBRDateTime(consolidado.updated_at)}` : "Gere a parcial do mês para disponibilizar o consolidado."}
              </div>
            </div>

            {consolidado?.publicUrl ? (
              <a
                href={consolidado.publicUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 text-white px-4 py-3 font-bold hover:bg-cyan-700"
              >
                <FaFilePdf /> Abrir Consolidado
              </a>
            ) : null}
          </div>
        </div>
      )}

      {subTab === "resumo" && (
        <div className="bg-white rounded-2xl border shadow-sm p-6">
          <SectionHeader
            title="Resumo das Parciais"
            description="Material executivo com visão geral da meritocracia no mês selecionado."
          />

          <div className="mt-5 rounded-2xl border bg-slate-50 p-5 flex items-center justify-between gap-4 flex-wrap">
            <div>
              <div className="text-sm font-bold text-slate-800">{resumo?.fileName || "Arquivo ainda não disponível"}</div>
              <div className="text-xs text-slate-500 mt-1">
                {resumo?.updated_at ? `Atualizado em ${fmtBRDateTime(resumo.updated_at)}` : "Gere a parcial do mês para disponibilizar o resumo executivo."}
              </div>
            </div>

            {resumo?.publicUrl ? (
              <a
                href={resumo.publicUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 text-white px-4 py-3 font-bold hover:bg-emerald-700"
              >
                <FaFilePdf /> Abrir Resumo
              </a>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

function DieselAgenteView({ onAlert }) {
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const hoje = useMemo(() => new Date(), []);
  const primeiroDiaPeriodo = useMemo(() => new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1), [hoje]);

  const [periodoInicio, setPeriodoInicio] = useState(fmtDateInput(primeiroDiaPeriodo));
  const [periodoFim, setPeriodoFim] = useState(fmtDateInput(hoje));
  const [userSession, setUserSession] = useState(null);

  const [loading, setLoading] = useState(false);
  const [loadingGerencial, setLoadingGerencial] = useState(false);
  const [loadingProntuarios, setLoadingProntuarios] = useState(false);

  const [ultimoGerencial, setUltimoGerencial] = useState(null);
  const [ultimaAnalise, setUltimaAnalise] = useState(null);
  const [sugestoes, setSugestoes] = useState([]);
  const [selected, setSelected] = useState({});
  const [sortConfig, setSortConfig] = useState({ key: "combustivel_desperdicado", direction: "desc" });

  const [busca, setBusca] = useState("");
  const [filtroLinha, setFiltroLinha] = useState("");
  const [viewingDetails, setViewingDetails] = useState(null);
  const [modalContent, setModalContent] = useState({ raioX: [], chartData: [] });

  const validarPeriodo = useCallback(() => {
    if (!periodoInicio || !periodoFim) return true;
    return periodoInicio <= periodoFim;
  }, [periodoInicio, periodoFim]);

  async function carregarTela() {
    setLoading(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      if (!mountedRef.current) return;
      setUserSession(sess?.session || null);

      const { data: rel } = await supabase
        .from("relatorios_gerados")
        .select("*")
        .eq("tipo", "diesel_gerencial")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!mountedRef.current) return;
      setUltimoGerencial(rel || null);

      const { data: ultAnalise } = await supabase
        .from("diesel_analise_gerencial_snapshot")
        .select("id, report_id, periodo_label, mes_atual_nome, created_at")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!mountedRef.current) return;
      setUltimaAnalise(ultAnalise || null);

      const { data: sug } = await supabase.from("v_sugestoes_acompanhamento_30d").select("*").limit(500);

      const { data: acompanhamentos } = await supabase
        .from("diesel_acompanhamentos")
        .select("motorista_chapa, status")
        .not("status", "in", '("OK","ENCERRADO","ATAS")');

      const mapStatusAtivo = {};
      (acompanhamentos || []).forEach((a) => {
        mapStatusAtivo[a.motorista_chapa] = a.status;
      });

      const sugestoesComStatus = (sug || []).map((s) => ({
        ...s,
        status_atual: mapStatusAtivo[s.motorista_chapa] || null,
      }));

      if (!mountedRef.current) return;
      setSugestoes(sugestoesComStatus);
    } catch (e) {
      onAlert?.({ type: "error", message: "Erro ao carregar: " + (e?.message || String(e)) });
    } finally {
      if (!mountedRef.current) return;
      setLoading(false);
    }
  }

  useEffect(() => {
    carregarTela();
  }, []);

  const openModal = async (motorista) => {
    let detalhes = motorista.detalhes_json || null;
    let nomeFallback = motorista.motorista_nome || null;

    if (!detalhes) {
      const mesRef = motorista.mes_ref || new Date().toISOString().slice(0, 7);
      const { data } = await supabase
        .from("diesel_sugestoes_acompanhamento")
        .select("detalhes_json, motorista_nome")
        .eq("chapa", motorista.motorista_chapa)
        .eq("mes_ref", mesRef)
        .maybeSingle();

      if (data?.detalhes_json) detalhes = data.detalhes_json;
      if (!nomeFallback && data?.motorista_nome) nomeFallback = data.motorista_nome;
    }

    setViewingDetails({ ...motorista, motorista_nome: nomeFallback });
    setModalContent({
      raioX: detalhes?.raio_x || [],
      chartData: detalhes?.grafico_semanal || [],
    });
  };

  const linhasUnicas = useMemo(() => {
    const linhas = (sugestoes || []).map((r) => String(r.linha_mais_rodada || "").trim().toUpperCase()).filter(Boolean);
    return [...new Set(linhas)].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [sugestoes]);

  const sugestoesFiltradas = useMemo(() => {
    return (sugestoes || []).filter((r) => {
      const linha = String(r.linha_mais_rodada || "").trim().toUpperCase();
      const nome = String(r.motorista_nome || "").toLowerCase();
      const chapa = String(r.motorista_chapa || "").toLowerCase();
      const q = busca.toLowerCase().trim();

      if (filtroLinha && linha !== filtroLinha) return false;
      if (q && !nome.includes(q) && !chapa.includes(q) && !linha.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [sugestoes, busca, filtroLinha]);

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  const sortedSugestoes = useMemo(() => {
    const items = [...sugestoesFiltradas];
    if (sortConfig.key) {
      items.sort((a, b) => {
        let aVal = a[sortConfig.key];
        let bVal = b[sortConfig.key];

        const nums = ["km_percorrido", "combustivel_consumido", "kml_realizado", "kml_meta", "combustivel_desperdicado"];
        if (nums.includes(sortConfig.key)) {
          aVal = n(aVal);
          bVal = n(bVal);
        } else {
          aVal = String(aVal || "").toLowerCase();
          bVal = String(bVal || "").toLowerCase();
        }

        if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }
    return items;
  }, [sugestoesFiltradas, sortConfig]);

  const dispararGerencial = async () => {
    if (loadingGerencial) return;
    setLoadingGerencial(true);

    try {
      const { data: record, error } = await supabase
        .from("relatorios_gerados")
        .insert({
          tipo: "diesel_gerencial",
          status: "PROCESSANDO",
          periodo_inicio: periodoInicio,
          periodo_fim: periodoFim,
          solicitante_login: userSession?.user?.email || "sistema",
          solicitante_nome: userSession?.user?.user_metadata?.full_name,
        })
        .select("id")
        .single();

      if (error) throw error;

      await dispatchGitHubWorkflow(WF_GERENCIAL, {
        report_id: String(record.id),
        periodo_inicio: periodoInicio,
        periodo_fim: periodoFim,
        report_tipo: "diesel_gerencial",
      });

      onAlert?.({ type: "success", message: `Relatório #${record.id} enviado.` });
      setTimeout(carregarTela, 2000);
    } catch (err) {
      onAlert?.({ type: "error", message: err?.message || String(err) });
    } finally {
      if (!mountedRef.current) return;
      setLoadingGerencial(false);
    }
  };

  const gerarFormulariosSelecionados = async () => {
    if (loadingProntuarios) return;
    setLoadingProntuarios(true);

    const selecionados = sugestoesFiltradas.filter((r) => selected[r.motorista_chapa]);
    if (!selecionados.length) {
      onAlert?.({ type: "error", message: "Selecione pelo menos 1 motorista." });
      setLoadingProntuarios(false);
      return;
    }

    try {
      const { data: lote, error: errL } = await supabase
        .from("acompanhamento_lotes")
        .insert({
          status: "PROCESSANDO",
          qtd: selecionados.length,
          extra: { origem: "v_sugestoes_acompanhamento_30d", gerado_em: new Date().toISOString() },
        })
        .select("id")
        .single();

      if (errL) throw errL;

      const itens = selecionados.map((r) => ({
        lote_id: lote.id,
        motorista_chapa: r.motorista_chapa,
        linha_mais_rodada: r.linha_mais_rodada ?? null,
        km_percorrido: n(r.km_percorrido),
        combustivel_consumido: n(r.combustivel_consumido),
        kml_realizado: n(r.kml_realizado),
        kml_meta: n(r.kml_meta),
        combustivel_desperdicado: n(r.combustivel_desperdicado),
        extra: { motorista_nome: r.motorista_nome ?? null },
      }));

      const { error: errI } = await supabase.from("acompanhamento_lote_itens").insert(itens);
      if (errI) throw errI;

      await dispatchGitHubWorkflow(WF_ACOMP, {
        ordem_batch_id: String(lote.id),
        qtd: String(selecionados.length),
      });

      onAlert?.({ type: "success", message: `Lote #${lote.id} enviado. Processando...` });
      setSelected({});
      setTimeout(carregarTela, 2500);
    } catch (err) {
      onAlert?.({ type: "error", message: err?.message || String(err) });
    } finally {
      if (!mountedRef.current) return;
      setLoadingProntuarios(false);
    }
  };

  const selectedCount = useMemo(() => Object.values(selected).filter(Boolean).length, [selected]);
  const allChecked = useMemo(() => {
    const disponiveis = sugestoesFiltradas.filter((r) => !r.status_atual);
    return disponiveis.length > 0 && disponiveis.every((r) => selected[r.motorista_chapa]);
  }, [sugestoesFiltradas, selected]);

  const toggleAll = () => {
    if (allChecked) {
      const novo = { ...selected };
      sugestoesFiltradas.forEach((r) => delete novo[r.motorista_chapa]);
      setSelected(novo);
    } else {
      const novo = { ...selected };
      sugestoesFiltradas.forEach((r) => {
        if (!r.status_atual) novo[r.motorista_chapa] = true;
      });
      setSelected(novo);
    }
  };

  const toggleOne = (chapa) => setSelected((p) => ({ ...p, [chapa]: !p[chapa] }));

  const totalKm = modalContent.raioX?.reduce((acc, r) => acc + n(r.km), 0) || 0;
  const totalLitros = modalContent.raioX?.reduce((acc, r) => acc + n(r.litros), 0) || 0;
  const totalDesperdicio = modalContent.raioX?.reduce((acc, r) => acc + n(r.desperdicio), 0) || 0;
  const kmlGeralReal = totalLitros > 0 ? totalKm / totalLitros : 0;

  const litrosTeoricosTotal =
    modalContent.raioX?.reduce((acc, r) => {
      const metaLinha = n(r.kml_meta);
      return acc + (metaLinha > 0 ? n(r.km) / metaLinha : 0);
    }, 0) || 0;

  const kmlGeralMeta = litrosTeoricosTotal > 0 ? totalKm / litrosTeoricosTotal : 0;
  const ultimoPdfUrl = getPublicUrl(BUCKET_RELATORIOS, ultimoGerencial?.arquivo_pdf_path);
  const ultimaAnaliseLabel = ultimaAnalise
    ? `Última análise gerada: Relatório #${ultimaAnalise.report_id || "-"} · ${ultimaAnalise.mes_atual_nome || ultimaAnalise.periodo_label || "-"} · ${ultimaAnalise.created_at ? new Date(ultimaAnalise.created_at).toLocaleDateString("pt-BR") : "-"}`
    : "Nenhuma análise gerada até o momento.";

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border shadow-sm p-4 space-y-4">
        <SectionHeader title="Relatório Gerencial" description="Disparo mensal do relatório e acompanhamento das sugestões de acompanhamento." />

        <div className="flex items-center justify-between bg-slate-50 border rounded-xl px-4 py-3 gap-4 flex-wrap">
          <div className="text-sm">
            <span className="text-slate-500 font-bold">Último Relatório: </span>
            {ultimoGerencial ? (
              <>
                <span className="font-extrabold text-slate-800">#{ultimoGerencial.id}</span>
                <span className="text-slate-500 text-xs ml-2">{fmtBRDate(ultimoGerencial.created_at)}</span>
                <span className="ml-3">
                  <StatusBadge status={ultimoGerencial.status} />
                </span>
              </>
            ) : (
              <span className="text-slate-500">Nenhum registro encontrado</span>
            )}
          </div>

          {ultimoGerencial?.status === "CONCLUIDO" && ultimoPdfUrl && (
            <a href={ultimoPdfUrl} target="_blank" rel="noopener noreferrer" className="text-cyan-700 font-extrabold inline-flex items-center gap-2 hover:underline">
              <FaFilePdf /> Abrir PDF
            </a>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <div>
            <label className="text-xs font-bold text-slate-500">Início</label>
            <input type="date" value={periodoInicio} onChange={(e) => setPeriodoInicio(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500">Fim</label>
            <input type="date" value={periodoFim} onChange={(e) => setPeriodoFim(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <button
            onClick={dispararGerencial}
            disabled={!validarPeriodo() || loadingGerencial}
            className={clsx("w-full py-3 rounded-xl flex justify-center gap-2 font-bold text-sm transition-colors", "bg-cyan-600 text-white hover:bg-cyan-700 disabled:bg-slate-300")}
          >
            <FaPlay className={clsx(loadingGerencial && "animate-spin")} /> {loadingGerencial ? "ENVIANDO..." : "DISPARAR RELATÓRIO"}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-rose-200 bg-rose-50 shadow-sm p-4">
        <div className="text-sm font-extrabold text-rose-700">{ultimaAnaliseLabel}</div>
      </div>

      <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b bg-slate-50 flex-wrap gap-4">
          <div>
            <h3 className="font-extrabold text-slate-800">Sugestões de Acompanhamento (30 dias)</h3>
            <p className="text-xs text-slate-500">Total: <b>{sugestoes.length}</b> | Filtrados: <b>{sugestoesFiltradas.length}</b></p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-xs text-slate-600">Selecionados: <b>{selectedCount}</b></div>
            <button
              onClick={gerarFormulariosSelecionados}
              disabled={selectedCount === 0 || loadingProntuarios}
              className={clsx(
                "px-4 py-2 rounded-xl font-extrabold text-sm transition-colors inline-flex items-center gap-2",
                selectedCount === 0 || loadingProntuarios ? "bg-slate-100 text-slate-400 cursor-not-allowed" : "bg-emerald-600 text-white hover:bg-emerald-700"
              )}
            >
              <FaSync className={clsx(loadingProntuarios && "animate-spin")} />
              {loadingProntuarios ? "GERANDO..." : "Gerar formulários"}
            </button>
          </div>
        </div>

        <div className="p-4 border-b bg-white">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
            <div className="relative md:col-span-2">
              <FaSearch className="absolute left-3 top-3.5 text-gray-400" />
              <input
                type="text"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar motorista, chapa ou linha..."
                className="w-full border rounded-xl pl-10 pr-4 py-3 text-sm"
              />
            </div>

            <div className="relative">
              <FaFilter className="absolute left-3 top-3.5 text-gray-400" />
              <select value={filtroLinha} onChange={(e) => setFiltroLinha(e.target.value)} className="w-full border rounded-xl pl-10 pr-4 py-3 text-sm bg-white">
                <option value="">Todas as linhas</option>
                {linhasUnicas.map((linha) => (
                  <option key={linha} value={linha}>{linha}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100 text-slate-700">
              <tr>
                <th className="p-3 text-left">
                  <input type="checkbox" checked={allChecked} onChange={toggleAll} />
                </th>
                <ThSortable label="Chapa" columnKey="motorista_chapa" sortConfig={sortConfig} onSort={handleSort} />
                <ThSortable label="Motorista" columnKey="motorista_nome" sortConfig={sortConfig} onSort={handleSort} />
                <ThSortable label="Linha" columnKey="linha_mais_rodada" sortConfig={sortConfig} onSort={handleSort} />
                <ThSortable label="KM" columnKey="km_percorrido" sortConfig={sortConfig} onSort={handleSort} align="right" />
                <ThSortable label="Litros" columnKey="combustivel_consumido" sortConfig={sortConfig} onSort={handleSort} align="right" />
                <ThSortable label="KM/L Real" columnKey="kml_realizado" sortConfig={sortConfig} onSort={handleSort} align="right" />
                <ThSortable label="KM/L Meta" columnKey="kml_meta" sortConfig={sortConfig} onSort={handleSort} align="right" />
                <ThSortable label="Desperdício" columnKey="combustivel_desperdicado" sortConfig={sortConfig} onSort={handleSort} align="right" />
                <th className="p-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {sortedSugestoes.map((r) => {
                const disabled = !!r.status_atual;
                return (
                  <tr key={r.motorista_chapa} className="border-t hover:bg-slate-50">
                    <td className="p-3">
                      <input type="checkbox" checked={!!selected[r.motorista_chapa]} disabled={disabled} onChange={() => toggleOne(r.motorista_chapa)} />
                    </td>
                    <td className="p-3 font-bold">{r.motorista_chapa || "-"}</td>
                    <td className="p-3">{r.motorista_nome || "-"}</td>
                    <td className="p-3">{r.linha_mais_rodada || "-"}</td>
                    <td className="p-3 text-right">{n(r.km_percorrido).toFixed(0)}</td>
                    <td className="p-3 text-right">{n(r.combustivel_consumido).toFixed(0)}</td>
                    <td className="p-3 text-right font-bold">{n(r.kml_realizado).toFixed(2)}</td>
                    <td className="p-3 text-right">{n(r.kml_meta).toFixed(2)}</td>
                    <td className="p-3 text-right text-rose-700 font-bold">{n(r.combustivel_desperdicado).toFixed(0)} L</td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {r.status_atual ? <StatusBadge status={r.status_atual} /> : null}
                        <button onClick={() => openModal(r)} className="px-3 py-2 rounded-lg bg-slate-900 text-white text-xs font-bold hover:bg-slate-800">
                          Detalhes
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {sortedSugestoes.length === 0 && (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-slate-500 font-medium">Nenhum registro encontrado com os filtros aplicados.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {viewingDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto flex flex-col">
            <div className="bg-slate-800 text-white p-5 flex justify-between items-start sticky top-0 z-20">
              <div>
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <FaBolt className="text-yellow-400" /> Auditoria de Eficiência
                </h3>
                <p className="text-slate-300 text-sm mt-1">{viewingDetails.motorista_chapa} - {viewingDetails.motorista_nome || "-"}</p>
                <div className="text-xs text-slate-400 mt-1">Dados processados pela IA no momento da sugestão.</div>
              </div>
              <button onClick={() => setViewingDetails(null)} className="text-slate-400 hover:text-white p-2 hover:bg-slate-700 rounded-full transition">
                <FaTimes size={20} />
              </button>
            </div>

            <div className="p-6 space-y-8 flex-1">
              {!modalContent.raioX || modalContent.raioX.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-slate-400 gap-3 border-2 border-dashed rounded-xl bg-slate-50">
                  <FaExclamationTriangle className="text-3xl text-slate-300" />
                  <p>Detalhes não disponíveis para este registro.</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <CardResumo icon={FaLayerGroup} titulo="KM Total" valor={totalKm.toFixed(0)} tone="cyan" />
                    <CardResumo icon={FaLayerGroup} titulo="Litros" valor={totalLitros.toFixed(0)} tone="amber" />
                    <CardResumo icon={FaLayerGroup} titulo="Desperdício" valor={totalDesperdicio.toFixed(0)} tone="rose" />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <CardResumo icon={FaLayerGroup} titulo="KM/L Real" valor={kmlGeralReal.toFixed(2)} tone="slate" />
                    <CardResumo icon={FaLayerGroup} titulo="KM/L Meta" valor={kmlGeralMeta.toFixed(2)} tone="emerald" />
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-slate-700 border-b pb-2">
                      <FaListAlt />
                      <h4 className="font-bold text-sm uppercase">Raio-X por linha</h4>
                    </div>
                    <div className="overflow-auto border rounded-xl">
                      <table className="min-w-full text-sm">
                        <thead className="bg-slate-100">
                          <tr>
                            <th className="p-3 text-left">Linha</th>
                            <th className="p-3 text-right">KM</th>
                            <th className="p-3 text-right">Litros</th>
                            <th className="p-3 text-right">KM/L Real</th>
                            <th className="p-3 text-right">KM/L Meta</th>
                            <th className="p-3 text-right">Desperdício</th>
                          </tr>
                        </thead>
                        <tbody>
                          {modalContent.raioX.map((r, idx) => (
                            <tr key={idx} className="border-t">
                              <td className="p-3">{r.linha || r.cluster || "-"}</td>
                              <td className="p-3 text-right">{n(r.km).toFixed(0)}</td>
                              <td className="p-3 text-right">{n(r.litros).toFixed(0)}</td>
                              <td className="p-3 text-right">{n(r.kml_real).toFixed(2)}</td>
                              <td className="p-3 text-right">{n(r.kml_meta).toFixed(2)}</td>
                              <td className="p-3 text-right font-bold text-rose-700">{n(r.desperdicio).toFixed(0)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-slate-700 border-b pb-2">
                      <FaListAlt />
                      <h4 className="font-bold text-sm uppercase">Evolução semanal</h4>
                    </div>
                    <SimpleLineChart data={modalContent.chartData || []} />
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DesempenhoDieselAgente() {
  const [mainTab, setMainTab] = useState("agente");
  const [feedback, setFeedback] = useState(null);

  const handleAlert = useCallback((payload) => {
    setFeedback(payload);
  }, []);

  useEffect(() => {
    if (!feedback) return;
    const t = setTimeout(() => setFeedback(null), 5000);
    return () => clearTimeout(t);
  }, [feedback]);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto relative">
      <div className="flex items-center justify-between gap-4 border-b pb-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-lg">
            {mainTab === "agente" ? <FaBolt size={20} /> : <FaTrophy size={20} />}
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-800">
              {mainTab === "agente" ? "Agente Diesel" : "Parcial de Meritocracia"}
            </h2>
            <p className="text-sm text-slate-500">
              {mainTab === "agente"
                ? "Sugestões de acompanhamento e disparo de workflows"
                : "Central mensal de parciais individuais, consolidado e resumo executivo"}
            </p>
          </div>
        </div>
      </div>

      {feedback && (
        <div
          className={clsx(
            "p-4 rounded-2xl border flex items-center gap-3 shadow-sm",
            feedback.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-rose-50 border-rose-200 text-rose-800"
          )}
        >
          {feedback.type === "success" ? <FaCheckCircle /> : <FaExclamationTriangle />}
          <div>
            <p className="font-bold text-sm">{feedback.type === "success" ? "Sucesso" : "Atenção"}</p>
            <p className="text-xs">{feedback.message}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <TabButton
          active={mainTab === "agente"}
          icon={FaBolt}
          title="AGENTE DIESEL"
          subtitle="Relatório gerencial, sugestões de acompanhamento e geração de formulários."
          onClick={() => setMainTab("agente")}
        />
        <TabButton
          active={mainTab === "parcial"}
          icon={FaTrophy}
          title="PARCIAL DE MERITOCRACIA"
          subtitle="Consulta profissional das parciais individuais, consolidado mensal e resumo geral."
          onClick={() => setMainTab("parcial")}
        />
      </div>

      {mainTab === "agente" ? <DieselAgenteView onAlert={handleAlert} /> : <ParcialMeritocraciaView onAlert={handleAlert} />}
    </div>
  );
}
