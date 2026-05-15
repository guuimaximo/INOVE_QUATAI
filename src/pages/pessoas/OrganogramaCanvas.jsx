import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  addEdge,
  useEdgesState,
  useNodesState,
} from "reactflow";
import "reactflow/dist/style.css";
import {
  FaSave,
  FaSync,
  FaSitemap,
  FaUsers,
  FaPlus,
  FaTimes,
  FaTrash,
  FaUserPlus,
  FaChevronDown,
  FaChevronRight,
  FaQuestionCircle,
  FaFileImage,
  FaFilePdf,
  FaFileExcel,
  FaFileImport,
  FaUserFriends,
  FaChartPie,
} from "react-icons/fa";

import { supabase } from "../../supabase";
import { supabaseBCNT } from "../../supabaseBCNT";

const CORES = {
  stone: { label: "Neutro", border: "border-slate-300", bg: "bg-white", chip: "bg-slate-100 text-slate-700", hex: "#94a3b8" },
  emerald: { label: "Verde", border: "border-emerald-300", bg: "bg-emerald-50", chip: "bg-emerald-100 text-emerald-700", hex: "#10b981" },
  blue: { label: "Azul", border: "border-blue-300", bg: "bg-blue-50", chip: "bg-blue-100 text-blue-700", hex: "#3b82f6" },
  amber: { label: "Amarelo", border: "border-amber-300", bg: "bg-amber-50", chip: "bg-amber-100 text-amber-700", hex: "#f59e0b" },
  sky: { label: "Ceu", border: "border-sky-300", bg: "bg-sky-50", chip: "bg-sky-100 text-sky-700", hex: "#0ea5e9" },
  orange: { label: "Laranja", border: "border-orange-300", bg: "bg-orange-50", chip: "bg-orange-100 text-orange-700", hex: "#f97316" },
  purple: { label: "Roxo", border: "border-purple-300", bg: "bg-purple-50", chip: "bg-purple-100 text-purple-700", hex: "#9333ea" },
  rose: { label: "Rosa", border: "border-rose-300", bg: "bg-rose-50", chip: "bg-rose-100 text-rose-700", hex: "#e11d48" },
};
const COR_OPTIONS = Object.keys(CORES);

// Paleta padronizada por nivel hierarquico
const NIVEIS = [
  { value: "DIRETOR", label: "Diretor", cor: "purple" },
  { value: "GERENTE", label: "Gerente", cor: "blue" },
  { value: "COORDENADOR", label: "Coordenador", cor: "sky" },
  { value: "SUPERVISOR", label: "Supervisor", cor: "amber" },
  { value: "LIDER", label: "Lider", cor: "emerald" },
  { value: "COLABORADOR", label: "Colaborador", cor: "stone" },
  { value: "FREELANCER", label: "Freelancer", cor: "orange" },
];
const NIVEL_BY_VALUE = new Map(NIVEIS.map((n) => [n.value, n]));

function corDaArea(area) {
  if (area.nivel && NIVEL_BY_VALUE.has(area.nivel)) {
    return NIVEL_BY_VALUE.get(area.nivel).cor;
  }
  return area.cor || "stone";
}

function inferirNivelPorTexto(texto = "") {
  const t = String(texto).toLowerCase();
  if (t.includes("diretor")) return "DIRETOR";
  if (t.includes("gerente")) return "GERENTE";
  if (t.includes("coordenador") || t.includes("coordenadora")) return "COORDENADOR";
  if (t.includes("supervisor") || t.includes("supervisora")) return "SUPERVISOR";
  if (t.includes("lider") || t.includes("líder")) return "LIDER";
  if (t.includes("freelancer") || t.includes("freela")) return "FREELANCER";
  return "COLABORADOR";
}

const SETORES = [
  { value: "PLANEJAMENTO_CONTROLE", label: "Planejamento e Controle" },
  { value: "ADMINISTRATIVO", label: "Administrativo" },
  { value: "MANUTENCAO", label: "Manutencao" },
  { value: "OPERACAO", label: "Operacao" },
];
const SETOR_LABELS = Object.fromEntries(SETORES.map((s) => [s.value, s.label]));

const TIPOS_HEADCOUNT = [
  { value: "REALIZADO", label: "Realizado" },
  { value: "ORCADO", label: "Orcado" },
  { value: "FREELANCER", label: "Freelancer" },
];

function calcTempoEmpresa(dataInicio) {
  if (!dataInicio) return "";
  const inicio = new Date(dataInicio);
  if (Number.isNaN(inicio.getTime())) return "";
  const agora = new Date();
  let anos = agora.getFullYear() - inicio.getFullYear();
  let meses = agora.getMonth() - inicio.getMonth();
  if (agora.getDate() < inicio.getDate()) meses -= 1;
  if (meses < 0) { anos -= 1; meses += 12; }
  if (anos <= 0 && meses <= 0) return "menos de 1 mes";
  const parts = [];
  if (anos > 0) parts.push(`${anos} ano${anos > 1 ? "s" : ""}`);
  if (meses > 0) parts.push(`${meses} m${meses > 1 ? "eses" : "es"}`);
  return parts.join(" e ");
}

function normalizeNome(s) {
  return String(s || "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function buildFuncionarioKey(value) {
  return String(
    value?.id_funcionario ||
    value?.funcionario_id ||
    value?.nr_cracha ||
    value?.funcionario_cracha ||
    normalizeNome(value?.nm_funcionario || value?.nome) ||
    ""
  );
}

const TIPO_OPTIONS = [
  { value: "GESTAO", label: "Lideranca" },
  { value: "SQUAD", label: "Equipe" },
  { value: "CELULA", label: "Celula" },
];

function pickCor(key) {
  return CORES[key] || CORES.stone;
}

function slugify(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function AreaNode({ data, selected }) {
  const cor = pickCor(data.corKey);
  const orcado = Number(data.orcado_total || 0);
  const realizado = Number(data.realizado_total || 0);
  const orcadoDireto = Number(data.orcado_direto || 0);
  const realizadoDireto = Number(data.realizado_direto || 0);
  const hasOpenDirectVacancy = orcadoDireto > realizadoDireto;
  const cobertura = orcado > 0 ? Math.min(100, Math.round((realizado / orcado) * 100)) : 0;
  const nivel = NIVEL_BY_VALUE.get(data.nivel);
  return (
    <div
      className={`min-w-[220px] max-w-[280px] rounded-2xl border-2 ${cor.border} ${cor.bg} p-3 shadow-sm transition ${
        hasOpenDirectVacancy ? "ring-2 ring-rose-300 ring-offset-2 ring-offset-white shadow-rose-100/80" : ""
      } ${
        selected ? "ring-2 ring-blue-500 ring-offset-2" : ""
      }`}
    >
      <Handle type="target" position={Position.Top} className="!h-2 !w-2 !bg-slate-400" />
      <div className="flex items-center justify-between gap-2">
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${cor.chip}`}>
          {nivel ? nivel.label : (data.tipo || "AREA")}
        </span>
        <span className="text-[10px] font-semibold text-slate-500">
          {data.descendentes ? `+${data.descendentes} abaixo` : "0 abaixo"}
        </span>
      </div>
      <div className="mt-2 text-sm font-black text-slate-900">{data.titulo}</div>
      {data.subtitulo ? <div className="text-xs text-slate-600">{data.subtitulo}</div> : null}

      <div className="mt-3 rounded-xl bg-white/70 px-3 py-2">
        <div className="flex items-center justify-between text-[11px] text-slate-500">
          <span>Direto</span>
          <span className="font-bold text-slate-800">{data.realizado_direto}/{data.orcado_direto || 0}</span>
        </div>
        <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
          <span>Total (cascata)</span>
          <span className="font-bold text-slate-800">{realizado}/{orcado || 0}</span>
        </div>
        {orcado > 0 ? (
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-200">
            <div className="h-full bg-emerald-500" style={{ width: `${cobertura}%` }} />
          </div>
        ) : null}
      </div>

      <Handle type="source" position={Position.Bottom} className="!h-2 !w-2 !bg-slate-400" />
    </div>
  );
}

const nodeTypes = { area: AreaNode };

const NIVEL_ROW = { DIRETOR: 0, GERENTE: 1, COORDENADOR: 2, SUPERVISOR: 3, LIDER: 4, COLABORADOR: 5, FREELANCER: 6 };

function autoLayout(areas) {
  const children = new Map();
  for (const a of areas) {
    const p = a.parent_codigo || null;
    if (!children.has(p)) children.set(p, []);
    children.get(p).push(a);
  }
  for (const [, list] of children) list.sort((x, y) => (x.ordem || 0) - (y.ordem || 0));

  const wLeaf = 280;
  const hLevel = 200;

  // 1. X via tree (centro entre filhos / espaco proporcional a folhas)
  const xLeafByCodigo = new Map();

  function placeX(codigo, leftLeafOffset) {
    const kids = children.get(codigo) || [];
    if (!kids.length) {
      xLeafByCodigo.set(codigo, leftLeafOffset);
      return 1;
    }
    let consumed = 0;
    const ranges = [];
    for (const k of kids) {
      const w = placeX(k.codigo, leftLeafOffset + consumed);
      ranges.push({ start: leftLeafOffset + consumed, width: w });
      consumed += w;
    }
    const start = ranges[0].start;
    const end = ranges[ranges.length - 1].start + ranges[ranges.length - 1].width - 1;
    xLeafByCodigo.set(codigo, (start + end) / 2);
    return consumed;
  }

  // 2. Depth como fallback quando area nao tem nivel
  const depths = new Map();
  function computeDepth(codigo, d = 0) {
    depths.set(codigo, d);
    for (const k of children.get(codigo) || []) computeDepth(k.codigo, d + 1);
  }

  let offset = 0;
  for (const r of (children.get(null) || [])) {
    placeX(r.codigo, offset);
    offset += countLeaves(r.codigo, children);
    computeDepth(r.codigo, 0);
  }

  // 3. Y por nivel hierarquico; mesmo nivel = mesma linha
  const positions = new Map();
  for (const a of areas) {
    const xLeaf = xLeafByCodigo.get(a.codigo) ?? 0;
    const row = a.nivel && NIVEL_ROW[a.nivel] != null ? NIVEL_ROW[a.nivel] : (depths.get(a.codigo) || 0);
    positions.set(a.codigo, { x: xLeaf * wLeaf, y: row * hLevel });
  }
  return positions;
}

function countLeaves(codigo, childrenMap) {
  const kids = childrenMap.get(codigo) || [];
  if (!kids.length) return 1;
  return kids.reduce((acc, k) => acc + countLeaves(k.codigo, childrenMap), 0);
}

function buildChildrenMap(areas) {
  const map = new Map();
  for (const a of areas) {
    const p = a.parent_codigo || null;
    if (!map.has(p)) map.set(p, []);
    map.get(p).push(a);
  }
  return map;
}

function collectDescendantCodes(codigo, childrenMap) {
  const out = new Set();
  function rec(c) {
    for (const k of childrenMap.get(c) || []) {
      if (out.has(k.codigo)) continue;
      out.add(k.codigo);
      rec(k.codigo);
    }
  }
  rec(codigo);
  return out;
}

function computeMetrics(area, pessoas, childrenMap) {
  const desc = collectDescendantCodes(area.codigo, childrenMap);
  const directRealizado = pessoas.filter((p) => p.area_codigo === area.codigo && p.tipo_headcount === "REALIZADO").length;
  const directOrcado = Number.isFinite(area.orcado_qtd) && area.orcado_qtd != null
    ? Number(area.orcado_qtd)
    : pessoas.filter((p) => p.area_codigo === area.codigo && p.tipo_headcount === "ORCADO").length;
  const cascadeAreas = new Set([area.codigo, ...desc]);
  const totalRealizado = pessoas.filter((p) => cascadeAreas.has(p.area_codigo) && p.tipo_headcount === "REALIZADO").length;
  const totalOrcado = (function () {
    let sum = 0;
    for (const c of cascadeAreas) {
      // Pega valor cadastrado se houver; senao conta pessoas ORCADO da area
      const a = (window.__ORG_AREAS_BY_CODE__ || new Map()).get(c);
      if (a && Number.isFinite(a.orcado_qtd) && a.orcado_qtd != null) sum += Number(a.orcado_qtd);
      else sum += pessoas.filter((p) => p.area_codigo === c && p.tipo_headcount === "ORCADO").length;
    }
    return sum;
  })();
  return { directRealizado, directOrcado, totalRealizado, totalOrcado, descendentes: desc.size };
}

function PessoaPickerModal({ open, contexto, funcionarios, alocacoesPorFuncId, areasByCode, onClose, onPick, saving }) {
  const [busca, setBusca] = useState("");
  useEffect(() => { if (open) setBusca(""); }, [open]);

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const arr = funcionarios.filter((f) => {
      if (!q) return true;
      return (
        (f.nm_funcionario || "").toLowerCase().includes(q) ||
        (f.nm_funcao || "").toLowerCase().includes(q) ||
        String(f.nr_cracha || "").toLowerCase().includes(q)
      );
    });
    return arr.slice(0, 200);
  }, [funcionarios, busca]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/60 p-4">
      <div className="flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" style={{ maxHeight: "85vh" }}>
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-600">Alocar pessoa</div>
            <div className="text-lg font-black text-slate-900">{contexto?.titulo || "Selecionar funcionario"}</div>
            {contexto?.subtitulo ? <div className="text-xs text-slate-500">{contexto.subtitulo}</div> : null}
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
            <FaTimes />
          </button>
        </div>

        <div className="px-6 py-3">
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome, cargo ou chapa..."
            autoFocus
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
          />
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-2">
          {lista.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
              Nenhum funcionario encontrado.
            </div>
          ) : (
            <div className="space-y-1.5">
              {lista.map((f) => {
                const key = buildFuncionarioKey(f);
                const aloc = alocacoesPorFuncId.get(key);
                const jaAlocado = !!aloc && aloc.pessoaId !== contexto?.pessoaIdAtual;
                const areaAloc = aloc ? (areasByCode.get(aloc.area_codigo)?.titulo || aloc.area_codigo) : "";
                return (
                  <button
                    key={key}
                    type="button"
                    disabled={jaAlocado || saving}
                    onClick={() => onPick(f)}
                    className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left transition ${
                      jaAlocado
                        ? "cursor-not-allowed border-slate-200 bg-slate-100 opacity-70"
                        : "border-slate-200 bg-white hover:border-blue-400 hover:bg-blue-50"
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold text-slate-800">{f.nm_funcionario || "(sem nome)"}</div>
                      <div className="truncate text-[11px] text-slate-500">
                        {f.nm_funcao || "—"}{f.nr_cracha ? ` · Chapa ${f.nr_cracha}` : ""}
                      </div>
                    </div>
                    {jaAlocado ? (
                      <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold uppercase text-rose-700">
                        Alocado em {areaAloc}
                      </span>
                    ) : (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-700">
                        Disponivel
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="border-t border-slate-200 bg-slate-50 px-6 py-3 text-[11px] text-slate-500">
          Pessoas ja alocadas em outra vaga aparecem em cinza. Para mover, remova da vaga antiga primeiro ou — se o cargo realmente reporta a dois lideres — desenhe uma seta adicional entre as caixas no canvas (sem duplicar a pessoa).
        </div>
      </div>
    </div>
  );
}

function QuadroDrawer({ open, onClose, funcionarios, pessoas, areas, alocacoesPorFuncId, areasByCode, onAlocar }) {
  const [tab, setTab] = useState("todos");
  const [busca, setBusca] = useState("");

  const enriched = useMemo(() => {
    return funcionarios.map((f) => {
      const key = buildFuncionarioKey(f);
      const aloc = alocacoesPorFuncId.get(key);
      const areaTitulo = aloc ? areasByCode.get(aloc.area_codigo)?.titulo : "";
      return {
        key,
        funcionario: f,
        alocado: !!aloc,
        area_codigo: aloc?.area_codigo,
        area_titulo: areaTitulo,
      };
    });
  }, [funcionarios, alocacoesPorFuncId, areasByCode]);

  const filtered = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return enriched.filter((row) => {
      if (tab === "alocados" && !row.alocado) return false;
      if (tab === "sobra" && row.alocado) return false;
      if (!q) return true;
      const f = row.funcionario;
      return (
        (f.nm_funcionario || "").toLowerCase().includes(q) ||
        (f.nm_funcao || "").toLowerCase().includes(q) ||
        String(f.nr_cracha || "").toLowerCase().includes(q) ||
        (row.area_titulo || "").toLowerCase().includes(q)
      );
    });
  }, [enriched, busca, tab]);

  const stats = useMemo(() => {
    const total = enriched.length;
    const alocados = enriched.filter((r) => r.alocado).length;
    const sobra = total - alocados;
    const orcadoAreas = areas.reduce((acc, a) => acc + Number(a.orcado_qtd || 0), 0);
    const vagasOrcadasPessoas = pessoas.filter((p) => p.tipo_headcount === "ORCADO").length;
    const totalOrcado = Math.max(orcadoAreas, vagasOrcadasPessoas);
    const realizadoTotal = pessoas.filter((p) => p.tipo_headcount === "REALIZADO").length;
    const vagasAbertas = Math.max(0, totalOrcado - realizadoTotal);
    return { total, alocados, sobra, totalOrcado, realizadoTotal, vagasAbertas };
  }, [enriched, areas, pessoas]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[75] flex justify-end bg-slate-900/40">
      <div className="flex h-full w-full max-w-2xl flex-col overflow-hidden bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-600">Quadro de pessoal</div>
            <div className="text-xl font-black text-slate-900">Funcionarios</div>
            <div className="text-xs text-slate-500">Quem esta no organograma e quem esta sobrando.</div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
            <FaTimes />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 border-b border-slate-200 px-6 py-4 md:grid-cols-4">
          <CardStat titulo="Funcionarios" valor={stats.total} cor="slate" />
          <CardStat titulo="Alocados" valor={stats.alocados} cor="emerald" />
          <CardStat titulo="Sobrando" valor={stats.sobra} cor="rose" />
          <CardStat titulo="Vagas abertas" valor={stats.vagasAbertas} cor="amber" />
          <CardStat titulo="Orcado total" valor={stats.totalOrcado} cor="blue" pequeno />
          <CardStat titulo="Realizado total" valor={stats.realizadoTotal} cor="emerald" pequeno />
          <CardStat
            titulo="Cobertura"
            valor={stats.totalOrcado > 0 ? `${Math.round((stats.realizadoTotal / stats.totalOrcado) * 100)}%` : "—"}
            cor="purple"
            pequeno
          />
          <CardStat
            titulo="% sobrando"
            valor={stats.total > 0 ? `${Math.round((stats.sobra / stats.total) * 100)}%` : "—"}
            cor="rose"
            pequeno
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-6 py-3">
          <button type="button" onClick={() => setTab("todos")} className={`rounded-lg px-3 py-1.5 text-xs font-bold ${tab === "todos" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>Todos ({enriched.length})</button>
          <button type="button" onClick={() => setTab("alocados")} className={`rounded-lg px-3 py-1.5 text-xs font-bold ${tab === "alocados" ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>Alocados ({stats.alocados})</button>
          <button type="button" onClick={() => setTab("sobra")} className={`rounded-lg px-3 py-1.5 text-xs font-bold ${tab === "sobra" ? "bg-rose-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>Sobrando ({stats.sobra})</button>
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome, cargo, chapa ou area..."
            className="ml-auto w-full min-w-[200px] flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs focus:border-blue-400 focus:outline-none md:w-auto"
          />
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-3">
          {filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
              Nenhum funcionario nesta lista.
            </div>
          ) : (
            <div className="space-y-1.5">
              {filtered.map((row) => (
                <div key={row.key} className={`flex items-center justify-between rounded-xl border px-3 py-2 ${row.alocado ? "border-emerald-200 bg-emerald-50/40" : "border-rose-200 bg-rose-50/30"}`}>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-bold text-slate-800">{row.funcionario.nm_funcionario}</div>
                    <div className="truncate text-[11px] text-slate-500">
                      {row.funcionario.nm_funcao || "—"}{row.funcionario.nr_cracha ? ` · Chapa ${row.funcionario.nr_cracha}` : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {row.alocado ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-700">
                        {row.area_titulo}
                      </span>
                    ) : (
                      <>
                        <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold uppercase text-rose-700">
                          Sobrando
                        </span>
                        <button
                          type="button"
                          onClick={() => onAlocar(row.funcionario)}
                          className="rounded-lg bg-blue-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-blue-700"
                        >
                          Alocar
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CardStat({ titulo, valor, cor = "slate", pequeno }) {
  const cls = {
    slate: "border-slate-200 bg-slate-50 text-slate-900",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-900",
    rose: "border-rose-200 bg-rose-50 text-rose-900",
    amber: "border-amber-200 bg-amber-50 text-amber-900",
    blue: "border-blue-200 bg-blue-50 text-blue-900",
    purple: "border-purple-200 bg-purple-50 text-purple-900",
  }[cor];
  return (
    <div className={`rounded-2xl border ${cls} px-3 py-2`}>
      <div className="text-[10px] font-bold uppercase tracking-[0.18em] opacity-70">{titulo}</div>
      <div className={`mt-0.5 font-black ${pequeno ? "text-base" : "text-2xl"}`}>{valor}</div>
    </div>
  );
}

function PuxarFuncoesModal({
  open,
  area,
  funcionarios,
  alocacoesPorFuncId,
  areasByCode,
  onClose,
  onImportOrcado,
  onImportRealizado,
  saving,
}) {
  const [selecionadas, setSelecionadas] = useState(new Set());
  const [busca, setBusca] = useState("");

  useEffect(() => {
    if (open) {
      setSelecionadas(new Set());
      setBusca("");
    }
  }, [open]);

  const funcoes = useMemo(() => {
    const map = new Map();
    for (const f of funcionarios) {
      const key = (f.nm_funcao || "").trim();
      if (!key) continue;
      if (!map.has(key)) map.set(key, { funcao: key, total: 0, disponiveis: 0, alocados: 0, areaExemplo: "" });
      const row = map.get(key);
      row.total += 1;
      const aloc = alocacoesPorFuncId.get(buildFuncionarioKey(f));
      if (aloc) {
        row.alocados += 1;
        row.areaExemplo = row.areaExemplo || (areasByCode.get(aloc.area_codigo)?.titulo || aloc.area_codigo || "");
      } else {
        row.disponiveis += 1;
      }
    }
    const list = Array.from(map.values()).sort((a, b) => a.funcao.localeCompare(b.funcao, "pt-BR"));
    if (!busca) return list;
    const q = busca.toLowerCase();
    return list.filter((f) => f.funcao.toLowerCase().includes(q));
  }, [funcionarios, busca, alocacoesPorFuncId, areasByCode]);

  function toggle(funcao) {
    setSelecionadas((prev) => {
      const next = new Set(prev);
      if (next.has(funcao)) next.delete(funcao);
      else next.add(funcao);
      return next;
    });
  }

  if (!open || !area) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/60 p-4">
      <div className="flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" style={{ maxHeight: "85vh" }}>
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-600">Importacao em massa</div>
            <div className="text-lg font-black text-slate-900">Puxar funcoes para "{area.titulo}"</div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
            <FaTimes />
          </button>
        </div>

        <div className="px-6 py-3">
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar funcao..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
          />
          <div className="mt-2 text-xs text-slate-500">
            {funcoes.length} funcao(oes) encontradas. Selecione e escolha se quer criar vagas orcadas ou puxar todas as pessoas reais dessa funcao.
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-2">
          {funcoes.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
              Nenhuma funcao encontrada na tabela de funcionarios.
            </div>
          ) : (
            <div className="space-y-1">
              {funcoes.map((f) => {
                const ativa = selecionadas.has(f.funcao);
                return (
                  <button
                    key={f.funcao}
                    type="button"
                    onClick={() => toggle(f.funcao)}
                    className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left transition ${
                      ativa ? "border-blue-500 bg-blue-50" : "border-slate-200 bg-white hover:bg-slate-50"
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold text-slate-800">{f.funcao}</div>
                      <div className="text-[11px] text-slate-500">
                        {f.total} funcionario(s) · {f.disponiveis} disponivel(is) · {f.alocados} ja alocado(s)
                      </div>
                      {f.areaExemplo ? (
                        <div className="text-[10px] text-slate-400">Ja existe gente dessa funcao em {f.areaExemplo}</div>
                      ) : null}
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${ativa ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"}`}>
                      {ativa ? "Selecionada" : "Adicionar"}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-4">
          <div className="text-xs text-slate-500">{selecionadas.size} selecionada(s)</div>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200">
              Cancelar
            </button>
            <button
              type="button"
              disabled={saving || !selecionadas.size}
              onClick={() => onImportOrcado(Array.from(selecionadas))}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              <FaFileImport /> {saving ? "Importando..." : "Importar como orcados"}
            </button>
            <button
              type="button"
              disabled={saving || !selecionadas.size}
              onClick={() => onImportRealizado(Array.from(selecionadas))}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              <FaFileImport /> {saving ? "Puxando..." : "Puxar pessoas reais"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function EntenderModal({ open, onClose, areas, childrenMap }) {
  if (!open) return null;

  // Encontra um exemplo natural de avo->pai->filho->neto nas areas existentes
  const exemplo = (function () {
    for (const avo of areas) {
      const pais = childrenMap.get(avo.codigo) || [];
      for (const pai of pais) {
        const filhos = childrenMap.get(pai.codigo) || [];
        for (const filho of filhos) {
          return { avo, pai, filho };
        }
      }
    }
    return null;
  })();

  const Card = ({ titulo, papel, descricao, cor }) => (
    <div className={`relative rounded-2xl border-2 ${cor} bg-white p-4 shadow-sm`}>
      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">{papel}</div>
      <div className="mt-1 text-base font-black text-slate-900">{titulo}</div>
      <div className="mt-1 text-xs text-slate-500">{descricao}</div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/60 p-4">
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-600">Como ler o organograma</div>
            <div className="text-lg font-black text-slate-900">Entender pai · filho · neto</div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
            <FaTimes />
          </button>
        </div>

        <div className="space-y-5 px-6 py-5">
          <p className="text-sm text-slate-600">
            Cada caixa do canvas e uma area. A seta que sai de uma caixa para outra mostra a hierarquia: quem esta acima e o "pai" da caixa de baixo.
          </p>

          <div className="space-y-3">
            <Card titulo="Diretoria de Manutencao" papel="Avo / Lideranca topo" descricao="Topo da estrutura. Manda no pai." cor="border-slate-400" />
            <div className="flex justify-center"><div className="h-6 w-0.5 bg-slate-300" /></div>
            <Card titulo="Gerencia de Planejamento" papel="Pai" descricao="Esta abaixo do avo e tem filhos." cor="border-blue-400" />
            <div className="flex justify-center"><div className="h-6 w-0.5 bg-slate-300" /></div>
            <Card titulo="Equipe PCM" papel="Filho" descricao="Responde para o pai. Pode ter netos." cor="border-emerald-400" />
            <div className="flex justify-center"><div className="h-6 w-0.5 bg-slate-300" /></div>
            <Card titulo="Celula Pneus" papel="Neto" descricao="Mais profundo da arvore. Responde ao filho." cor="border-amber-400" />
          </div>

          {exemplo ? (
            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
              <div className="text-[11px] font-black uppercase tracking-[0.2em] text-blue-700">Exemplo do seu organograma</div>
              <div className="mt-2 grid grid-cols-1 gap-2 text-sm text-blue-900">
                <div>
                  <span className="font-bold">Avo:</span> {exemplo.avo.titulo}
                </div>
                <div>
                  <span className="font-bold">Pai:</span> {exemplo.pai.titulo}{" "}
                  <span className="text-blue-600">(esta abaixo de {exemplo.avo.titulo})</span>
                </div>
                <div>
                  <span className="font-bold">Filho:</span> {exemplo.filho.titulo}{" "}
                  <span className="text-blue-600">(esta abaixo de {exemplo.pai.titulo}, ou seja, neto de {exemplo.avo.titulo})</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
              Crie pelo menos 3 niveis de areas (uma sob a outra) para ver um exemplo real aqui.
            </div>
          )}

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            <div className="font-bold text-slate-800">Dica</div>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-slate-600">
              <li>Quando clicar em uma caixa, o numero <strong>"+N abaixo"</strong> mostra quantas caixas existem na sub-arvore inteira (filhos + netos + bisnetos).</li>
              <li>O painel lateral mostra Orcado (vagas planejadas) e Realizado (quem esta nessas vagas).</li>
              <li>O total em cascata soma todas as pessoas abaixo daquele gestor.</li>
            </ul>
          </div>
        </div>

        <div className="flex justify-end border-t border-slate-200 bg-slate-50 px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700">
            Entendi
          </button>
        </div>
      </div>
    </div>
  );
}

function FormField({ label, children }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</span>
      {children}
    </label>
  );
}

function inputCls() {
  return "rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-400 focus:outline-none";
}

function NovaAreaModal({ open, areas, onClose, onCreate, saving, defaultSetor }) {
  const [titulo, setTitulo] = useState("");
  const [subtitulo, setSubtitulo] = useState("");
  const [parentCodigo, setParentCodigo] = useState("");
  const [tipo, setTipo] = useState("SQUAD");
  const [nivel, setNivel] = useState("COLABORADOR");
  const [setor, setSetor] = useState(defaultSetor || "");
  const [orcadoQtd, setOrcadoQtd] = useState("");

  useEffect(() => {
    if (open) {
      setTitulo("");
      setSubtitulo("");
      setParentCodigo("");
      setTipo("SQUAD");
      setNivel("COLABORADOR");
      setSetor(defaultSetor || "");
      setOrcadoQtd("");
    }
  }, [open, defaultSetor]);

  // Sugere nivel a partir do subtitulo
  useEffect(() => {
    if (subtitulo) setNivel(inferirNivelPorTexto(subtitulo));
  }, [subtitulo]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="text-lg font-black text-slate-900">Nova caixa</div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
            <FaTimes />
          </button>
        </div>
        <div className="space-y-4 px-6 py-5">
          <div className="rounded-xl border border-blue-100 bg-blue-50/60 px-3 py-2 text-[11px] text-blue-800">
            <strong>Titulo</strong> = nome da area ou da pessoa que ocupa o cargo. Ex: <em>"Guilherme Maximo"</em> ou <em>"Equipe PCM"</em>.<br />
            <strong>Subtitulo</strong> = cargo ou descricao curta. Ex: <em>"Gerente de Planejamento"</em> ou <em>"Backoffice de manutencao"</em>.
          </div>
          <FormField label="Titulo (nome da area ou da pessoa)">
            <input
              className={inputCls()}
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex: Guilherme Maximo / Equipe PCM"
              autoFocus
            />
          </FormField>
          <FormField label="Subtitulo (cargo ou descricao)">
            <input
              className={inputCls()}
              value={subtitulo}
              onChange={(e) => setSubtitulo(e.target.value)}
              placeholder="Ex: Gerente de Planejamento"
            />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Nivel hierarquico">
              <select className={inputCls()} value={nivel} onChange={(e) => setNivel(e.target.value)}>
                {NIVEIS.map((n) => <option key={n.value} value={n.value}>{n.label}</option>)}
              </select>
            </FormField>
            <FormField label="Setor">
              <select className={inputCls()} value={setor} onChange={(e) => setSetor(e.target.value)}>
                <option value="">(sem setor)</option>
                {SETORES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Tipo (visual)">
              <select className={inputCls()} value={tipo} onChange={(e) => setTipo(e.target.value)}>
                {TIPO_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </FormField>
            <FormField label="Orcado de pessoas">
              <input type="number" min="0" className={inputCls()} value={orcadoQtd} onChange={(e) => setOrcadoQtd(e.target.value)} />
            </FormField>
          </div>
          <FormField label="Area pai (opcional)">
            <select className={inputCls()} value={parentCodigo} onChange={(e) => setParentCodigo(e.target.value)}>
              <option value="">Sem pai (raiz)</option>
              {areas.map((a) => <option key={a.codigo} value={a.codigo}>{a.titulo}</option>)}
            </select>
          </FormField>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200">
            Cancelar
          </button>
          <button
            type="button"
            disabled={saving || !titulo.trim()}
            onClick={() => onCreate({ titulo: titulo.trim(), subtitulo: subtitulo.trim(), parent_codigo: parentCodigo || null, tipo, nivel, setor: setor || null, cor: NIVEL_BY_VALUE.get(nivel)?.cor || "stone", orcado_qtd: orcadoQtd === "" ? null : Number(orcadoQtd) })}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            <FaPlus /> {saving ? "Criando..." : "Criar caixa"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SidePanel({
  area, areas, pessoas, childrenMap, funcByNome,
  onPuxarFuncoes, onAddVaga, onAbrirPicker, onEditarPessoa, onRemoverPessoa,
  onClose, onSave, onDelete, saving,
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(null);
  const [pessoasAbertas, setPessoasAbertas] = useState(true);
  const [subAbertas, setSubAbertas] = useState(true);

  useEffect(() => {
    setEditing(false);
    setDraft(null);
  }, [area?.codigo]);

  if (!area) return null;

  const metrics = computeMetrics(area, pessoas, childrenMap);
  const pessoasArea = pessoas.filter((p) => p.area_codigo === area.codigo);
  const pessoasRealizadas = pessoasArea.filter((p) => p.tipo_headcount === "REALIZADO");
  const pessoasOrcadasCadastradas = pessoasArea.filter((p) => p.tipo_headcount === "ORCADO");
  const orcadoQtd = metrics.directOrcado;
  const vagasOrcadas = (function () {
    const slots = pessoasOrcadasCadastradas.map((p) => ({
      id: p.id,
      orcadoId: p.id,
      realizadoId: null,
      cargoOrcado: p.cargo || "Vaga planejada",
      nomeOrcado: p.nome || "",
      preenchida: false,
      nomeRealizado: "",
      cargoRealizado: "",
    }));
    while (slots.length < orcadoQtd) {
      slots.push({
        id: `vaga-${slots.length}`,
        orcadoId: null,
        realizadoId: null,
        cargoOrcado: "Vaga planejada",
        nomeOrcado: "",
        preenchida: false,
        nomeRealizado: "",
        cargoRealizado: "",
      });
    }
    pessoasRealizadas.forEach((p, idx) => {
      if (idx >= slots.length) {
        slots.push({
          id: `vaga-extra-${idx}`,
          orcadoId: null,
          realizadoId: p.id,
          cargoOrcado: p.cargo || "Sem cargo orcado",
          nomeOrcado: "",
          preenchida: true,
          nomeRealizado: p.nome || "(sem nome)",
          cargoRealizado: p.cargo || "",
        });
      } else {
        slots[idx].preenchida = true;
        slots[idx].realizadoId = p.id;
        slots[idx].nomeRealizado = p.nome || "(sem nome)";
        slots[idx].cargoRealizado = p.cargo || "";
        if (!slots[idx].cargoOrcado || slots[idx].cargoOrcado === "Vaga planejada") {
          slots[idx].cargoOrcado = p.cargo || slots[idx].cargoOrcado;
        }
      }
    });
    return slots;
  })();
  const subAreas = childrenMap.get(area.codigo) || [];
  const desc = collectDescendantCodes(area.codigo, childrenMap);

  function startEdit() {
    setDraft({
      titulo: area.titulo || "",
      subtitulo: area.subtitulo || "",
      tipo: area.tipo || "SQUAD",
      nivel: area.nivel || inferirNivelPorTexto(area.subtitulo),
      setor: area.setor || "",
      parent_codigo: area.parent_codigo || "",
      orcado_qtd: area.orcado_qtd ?? "",
    });
    setEditing(true);
  }

  function setDraftField(k, v) {
    setDraft((d) => ({ ...d, [k]: v }));
  }

  async function commit() {
    if (!draft) return;
    await onSave(area.codigo, {
      titulo: draft.titulo,
      subtitulo: draft.subtitulo,
      tipo: draft.tipo,
      nivel: draft.nivel,
      setor: draft.setor || null,
      cor: NIVEL_BY_VALUE.get(draft.nivel)?.cor || "stone",
      parent_codigo: draft.parent_codigo || null,
      orcado_qtd: draft.orcado_qtd === "" || draft.orcado_qtd == null ? null : Number(draft.orcado_qtd),
    });
    setEditing(false);
  }

  return (
    <div className="absolute right-0 top-0 z-30 flex h-full w-full max-w-lg flex-col border-l border-slate-200 bg-white shadow-2xl">
      <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
        <div className="min-w-0">
          <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-600">Detalhe da area</div>
          {editing ? (
            <input
              autoFocus
              className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1 text-base font-black text-slate-900 focus:border-blue-400 focus:outline-none"
              value={draft.titulo}
              onChange={(e) => setDraftField("titulo", e.target.value)}
            />
          ) : (
            <div className="mt-0.5 text-xl font-black text-slate-900">{area.titulo}</div>
          )}
          {!editing && area.subtitulo ? <div className="text-sm text-slate-500">{area.subtitulo}</div> : null}
        </div>
        <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
          <FaTimes />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {/* Metricas */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Direto</div>
            <div className="mt-1 text-lg font-black text-slate-900">
              {metrics.directRealizado}<span className="text-slate-400">/{metrics.directOrcado || 0}</span>
            </div>
            <div className="text-xs text-slate-500">Pessoas nesta area</div>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
            <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-600">Total (cascata)</div>
            <div className="mt-1 text-lg font-black text-emerald-900">
              {metrics.totalRealizado}<span className="text-emerald-600/60">/{metrics.totalOrcado || 0}</span>
            </div>
            <div className="text-xs text-emerald-700">+{metrics.descendentes} sub-area(s)</div>
          </div>
        </div>

        {/* Edicao */}
        {editing ? (
          <div className="space-y-3 rounded-2xl border border-slate-200 p-4">
            <FormField label="Subtitulo">
              <input className={inputCls()} value={draft.subtitulo} onChange={(e) => setDraftField("subtitulo", e.target.value)} />
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Nivel">
                <select className={inputCls()} value={draft.nivel} onChange={(e) => setDraftField("nivel", e.target.value)}>
                  {NIVEIS.map((n) => <option key={n.value} value={n.value}>{n.label}</option>)}
                </select>
              </FormField>
              <FormField label="Setor">
                <select className={inputCls()} value={draft.setor} onChange={(e) => setDraftField("setor", e.target.value)}>
                  <option value="">(sem setor)</option>
                  {SETORES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </FormField>
            </div>
            <FormField label="Tipo (visual)">
              <select className={inputCls()} value={draft.tipo} onChange={(e) => setDraftField("tipo", e.target.value)}>
                {TIPO_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Area pai">
                <select className={inputCls()} value={draft.parent_codigo} onChange={(e) => setDraftField("parent_codigo", e.target.value)}>
                  <option value="">Sem pai (raiz)</option>
                  {areas
                    .filter((a) => a.codigo !== area.codigo && !desc.has(a.codigo))
                    .map((a) => <option key={a.codigo} value={a.codigo}>{a.titulo}</option>)}
                </select>
              </FormField>
              <FormField label="Orcado de pessoas">
                <input
                  type="number" min="0" className={inputCls()}
                  value={draft.orcado_qtd}
                  onChange={(e) => setDraftField("orcado_qtd", e.target.value)}
                />
              </FormField>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setEditing(false)} className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200">Cancelar</button>
              <button type="button" disabled={saving} onClick={commit} className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60">
                {saving ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={startEdit} className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800">
              Editar
            </button>
            <button
              type="button"
              onClick={() => onPuxarFuncoes(area)}
              className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700"
            >
              <FaFileImport /> Puxar funcoes
            </button>
            <button
              type="button"
              onClick={() => {
                if (confirm(`Remover a area "${area.titulo}"? Sub-areas continuarao mas perdem o pai.`)) {
                  onDelete(area.codigo);
                }
              }}
              className="inline-flex items-center gap-1 rounded-lg bg-rose-100 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-200"
            >
              <FaTrash /> Excluir
            </button>
          </div>
        )}

        {/* Sub-areas */}
        <div className="rounded-2xl border border-slate-200 p-3">
          <button type="button" onClick={() => setSubAbertas((v) => !v)} className="flex w-full items-center justify-between text-left">
            <div className="text-sm font-black uppercase tracking-wide text-slate-700">Sub-areas ({subAreas.length})</div>
            {subAbertas ? <FaChevronDown className="text-slate-400" /> : <FaChevronRight className="text-slate-400" />}
          </button>
          {subAbertas ? (
            subAreas.length ? (
              <div className="mt-2 space-y-1.5">
                {subAreas.map((s) => {
                  const m = computeMetrics(s, pessoas, childrenMap);
                  return (
                    <div key={s.codigo} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm">
                      <div className="min-w-0">
                        <div className="truncate font-bold text-slate-800">{s.titulo}</div>
                        <div className="text-[11px] text-slate-500">{s.tipo}</div>
                      </div>
                      <div className="text-xs font-bold text-slate-700">{m.totalRealizado}/{m.totalOrcado || 0}</div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="mt-2 text-xs text-slate-500">Esta area nao tem sub-areas.</div>
            )
          ) : null}
        </div>

        {/* Orcado x Realizado lado a lado por vaga */}
        <div className="rounded-2xl border border-slate-200 bg-white p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm font-black uppercase tracking-wide text-slate-700">
              Vagas ({vagasOrcadas.length})
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-600">
                {pessoasRealizadas.length}/{vagasOrcadas.length} preenchida(s)
              </span>
              <button
                type="button"
                onClick={() => {
                  const cargo = prompt("Cargo / funcao da nova vaga orcada:", "");
                  if (cargo && cargo.trim()) onAddVaga(area, cargo.trim());
                }}
                className="inline-flex items-center gap-1 rounded-lg bg-amber-500 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-amber-600"
              >
                + Vaga
              </button>
              <button
                type="button"
                onClick={() => onAbrirPicker({ areaAlvo: area })}
                className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-emerald-700"
              >
                + Pessoa
              </button>
            </div>
          </div>

          {vagasOrcadas.length ? (
            <div className="mt-3 space-y-2">
              <div className="grid grid-cols-2 gap-2 text-[10px] font-black uppercase tracking-[0.18em]">
                <div className="rounded-lg bg-amber-100 px-2 py-1 text-amber-800">Vaga orcada</div>
                <div className="rounded-lg bg-emerald-100 px-2 py-1 text-emerald-800">Vaga realizado</div>
              </div>
              {vagasOrcadas.map((vaga, idx) => {
                const func = vaga.preenchida ? funcByNome?.get(normalizeNome(vaga.nomeRealizado)) : null;
                const tempo = func ? calcTempoEmpresa(func.dt_inicio_atividade) : "";
                const orcadoPessoa = vaga.orcadoId
                  ? pessoasArea.find((p) => p.id === vaga.orcadoId && p.tipo_headcount === "ORCADO")
                  : null;
                const realizadoPessoa = vaga.realizadoId
                  ? pessoasArea.find((p) => p.id === vaga.realizadoId && p.tipo_headcount === "REALIZADO")
                  : null;
                const cargoOrc = (vaga.cargoOrcado || "").trim();
                const cargoReal = (vaga.cargoRealizado || "").trim();
                const cargoMatch = vaga.preenchida && cargoOrc && cargoReal
                  ? normalizeNome(cargoOrc) === normalizeNome(cargoReal)
                  : null;
                return (
                  <div key={vaga.id || `vaga-${idx}`} className="rounded-xl border border-slate-200 bg-white p-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="group relative rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2">
                        <div className="flex items-start justify-between gap-1">
                          <div className="text-[10px] font-bold uppercase tracking-wide text-amber-700">Orcado</div>
                          {orcadoPessoa ? (
                            <div className="flex gap-1 opacity-60 group-hover:opacity-100">
                              <button
                                type="button"
                                title="Editar cargo da vaga"
                                onClick={() => {
                                  const novo = prompt("Cargo da vaga:", orcadoPessoa.cargo || "");
                                  if (novo != null) onEditarPessoa(orcadoPessoa.id, { cargo: novo.trim() });
                                }}
                                className="rounded bg-amber-200 px-1 text-[10px] font-bold text-amber-800 hover:bg-amber-300"
                              >
                                edit
                              </button>
                              <button
                                type="button"
                                title="Remover vaga"
                                onClick={() => {
                                  if (confirm("Remover esta vaga orcada?")) onRemoverPessoa(orcadoPessoa.id);
                                }}
                                className="rounded bg-rose-100 px-1 text-[10px] font-bold text-rose-700 hover:bg-rose-200"
                              >
                                ×
                              </button>
                            </div>
                          ) : null}
                        </div>
                        <div className="mt-0.5 break-words text-sm font-bold leading-tight text-slate-900">
                          {vaga.cargoOrcado || vaga.cargo || "Vaga planejada"}
                        </div>
                        {vaga.nomeOrcado ? (
                          <div className="mt-0.5 break-words text-[11px] text-slate-500">{vaga.nomeOrcado}</div>
                        ) : null}
                      </div>
                      <div className={`group relative rounded-lg border px-3 py-2 ${
                        vaga.preenchida ? "border-emerald-200 bg-emerald-50/60" : "border-dashed border-slate-300 bg-slate-50"
                      }`}>
                        <div className="flex items-start justify-between gap-1">
                          <div className={`text-[10px] font-bold uppercase tracking-wide ${
                            vaga.preenchida ? "text-emerald-700" : "text-slate-500"
                          }`}>
                            {vaga.preenchida ? "Realizado" : "Em aberto"}
                          </div>
                          {realizadoPessoa ? (
                            <div className="flex gap-1 opacity-60 group-hover:opacity-100">
                              <button
                                type="button"
                                title="Trocar pessoa"
                                onClick={() => onAbrirPicker({ areaAlvo: area, pessoaIdAtual: realizadoPessoa.id })}
                                className="rounded bg-emerald-200 px-1 text-[10px] font-bold text-emerald-800 hover:bg-emerald-300"
                              >
                                trocar
                              </button>
                              <button
                                type="button"
                                title="Remover pessoa"
                                onClick={() => {
                                  if (confirm("Remover esta pessoa da area?")) onRemoverPessoa(realizadoPessoa.id);
                                }}
                                className="rounded bg-rose-100 px-1 text-[10px] font-bold text-rose-700 hover:bg-rose-200"
                              >
                                ×
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onAbrirPicker({ areaAlvo: area })}
                              className="rounded bg-blue-100 px-1.5 text-[10px] font-bold text-blue-700 opacity-60 hover:bg-blue-200 group-hover:opacity-100"
                            >
                              alocar
                            </button>
                          )}
                        </div>
                        <div className="mt-0.5 break-words text-sm font-bold leading-tight text-slate-900">
                          {vaga.preenchida ? vaga.nomeRealizado : "—"}
                        </div>
                        {vaga.preenchida && vaga.cargoRealizado ? (
                          <div className="mt-0.5 break-words text-[11px] text-slate-500">{vaga.cargoRealizado}</div>
                        ) : null}
                        {func ? (
                          <div className="mt-1 rounded-md bg-white/70 px-1.5 py-1 text-[10px] text-slate-600">
                            <div>Admissao: <strong>{new Date(func.dt_inicio_atividade).toLocaleDateString("pt-BR")}</strong></div>
                            {tempo ? <div>Empresa: <strong>{tempo}</strong></div> : null}
                          </div>
                        ) : null}
                      </div>
                    </div>
                    {cargoMatch === true ? (
                      <div className="mt-2 rounded-lg bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700">
                        ✓ Funcao do realizado bate com a vaga orcada
                      </div>
                    ) : cargoMatch === false ? (
                      <div className="mt-2 rounded-lg bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-800">
                        ⚠ Funcao diferente: vaga pede <strong>{cargoOrc}</strong>, pessoa exerce <strong>{cargoReal}</strong>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="mt-2 text-xs text-slate-500">Nenhuma vaga orcada definida para esta area.</div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function OrganogramaCanvas() {
  const [areas, setAreas] = useState([]);
  const [pessoas, setPessoas] = useState([]);
  const [funcionarios, setFuncionarios] = useState([]);
  const [setorFiltro, setSetorFiltro] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [novaOpen, setNovaOpen] = useState(false);
  const [entenderOpen, setEntenderOpen] = useState(false);
  const [puxarFuncoesArea, setPuxarFuncoesArea] = useState(null);
  const [exportando, setExportando] = useState(false);
  const [quadroOpen, setQuadroOpen] = useState(false);
  const [pickerContext, setPickerContext] = useState(null);
  const [selecionadoId, setSelecionadoId] = useState(null);
  const [statusMsg, setStatusMsg] = useState("");
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const dirtyRef = useRef(new Map());
  const reactFlowInstance = useRef(null);

  async function carregarFuncionariosBCNT() {
    const pageSize = 1000;
    let start = 0;
    let all = [];
    try {
      while (true) {
        const { data, error } = await supabaseBCNT
          .from("funcionarios_atualizada")
          .select("id_funcionario, nr_cracha, nm_funcionario, nm_funcao, dt_inicio_atividade, status")
          .eq("status", "ativo")
          .order("nm_funcionario", { ascending: true })
          .range(start, start + pageSize - 1);
        if (error) throw error;
        const chunk = data || [];
        all = all.concat(chunk);
        if (chunk.length < pageSize) break;
        start += pageSize;
        if (all.length >= 30000) break;
      }
      return all;
    } catch (error) {
      console.error("Erro ao carregar funcionarios:", error);
      return [];
    }
  }

  async function carregar() {
    setLoading(true);
    const [areasResp, pessoasResp, funcList] = await Promise.all([
      supabase.from("organograma_manutencao_areas").select("*").eq("ativo", true),
      supabase.from("organograma_manutencao_pessoas").select("*").eq("ativo", true),
      carregarFuncionariosBCNT(),
    ]);
    setLoading(false);
    if (areasResp.error || pessoasResp.error) {
      console.error(areasResp.error || pessoasResp.error);
      alert("Nao foi possivel carregar o organograma.");
      return;
    }
    setAreas(areasResp.data || []);
    setPessoas(pessoasResp.data || []);
    setFuncionarios(funcList);
  }

  useEffect(() => { carregar(); }, []);

  const areasFiltradas = useMemo(() => {
    if (!setorFiltro) return areas;
    // mantem area se ela ou qualquer descendente pertence ao setor
    const byCode = new Map(areas.map((a) => [a.codigo, a]));
    const children = buildChildrenMap(areas);
    function temSetorRec(codigo) {
      const a = byCode.get(codigo);
      if (a?.setor === setorFiltro) return true;
      const filhos = children.get(codigo) || [];
      return filhos.some((f) => temSetorRec(f.codigo));
    }
    return areas.filter((a) => a.setor === setorFiltro || temSetorRec(a.codigo));
  }, [areas, setorFiltro]);

  const childrenMap = useMemo(() => buildChildrenMap(areasFiltradas), [areasFiltradas]);
  const areasByCode = useMemo(() => new Map(areasFiltradas.map((a) => [a.codigo, a])), [areasFiltradas]);
  const funcByNome = useMemo(() => {
    const m = new Map();
    for (const f of funcionarios) m.set(normalizeNome(f.nm_funcionario), f);
    return m;
  }, [funcionarios]);

  const allAreasByCode = useMemo(() => new Map(areas.map((a) => [a.codigo, a])), [areas]);

  // Indice: funcionario_id -> { pessoaId, area_codigo }
  const alocacoesPorFuncId = useMemo(() => {
    const m = new Map();
    for (const p of pessoas) {
      if (p.tipo_headcount !== "REALIZADO") continue;
      const key = buildFuncionarioKey(p);
      if (!key) continue;
      m.set(key, { pessoaId: p.id, area_codigo: p.area_codigo });
    }
    return m;
  }, [pessoas]);

  useEffect(() => {
    // Expose por window pra computeMetrics conseguir ler orcado por area
    window.__ORG_AREAS_BY_CODE__ = areasByCode;
  }, [areasByCode]);

  useEffect(() => {
    if (!areasFiltradas.length) {
      setNodes([]);
      setEdges([]);
      return;
    }
    const auto = autoLayout(areasFiltradas);
    const newNodes = areasFiltradas.map((a) => {
      const auto1 = auto.get(a.codigo) || { x: 0, y: 0 };
      const x = a.canvas_x != null ? Number(a.canvas_x) : auto1.x;
      const y = a.canvas_y != null ? Number(a.canvas_y) : auto1.y;
      const m = computeMetrics(a, pessoas, childrenMap);
      return {
        id: a.codigo,
        type: "area",
        position: { x, y },
        data: {
          codigo: a.codigo,
          titulo: a.titulo,
          subtitulo: a.subtitulo,
          tipo: a.tipo,
          nivel: a.nivel,
          setor: a.setor,
          corKey: corDaArea(a),
          orcado_direto: m.directOrcado,
          realizado_direto: m.directRealizado,
          orcado_total: m.totalOrcado,
          realizado_total: m.totalRealizado,
          descendentes: m.descendentes,
        },
      };
    });
    const filtradosCodigos = new Set(areasFiltradas.map((a) => a.codigo));
    const newEdges = areasFiltradas
      .filter((a) => a.parent_codigo && filtradosCodigos.has(a.parent_codigo))
      .map((a) => ({
        id: `e-${a.parent_codigo}-${a.codigo}`,
        source: a.parent_codigo,
        target: a.codigo,
        type: "smoothstep",
        animated: false,
        style: { stroke: "#94a3b8", strokeWidth: 2 },
      }));
    setNodes(newNodes);
    setEdges(newEdges);
  }, [areasFiltradas, pessoas, childrenMap, setEdges, setNodes]);

  const onConnect = useCallback((params) => setEdges((eds) => addEdge({ ...params, type: "smoothstep" }, eds)), [setEdges]);

  function handleNodesChange(changes) {
    onNodesChange(changes);
    for (const c of changes) {
      if (c.type === "position" && c.position && !c.dragging) {
        dirtyRef.current.set(c.id, { x: c.position.x, y: c.position.y });
      }
    }
  }

  async function organizarOrganograma() {
    if (!areasFiltradas.length) {
      setStatusMsg("Sem areas para organizar.");
      return;
    }
    setSaving(true);
    setStatusMsg("");
    try {
      const novas = autoLayout(areasFiltradas);
      const updates = [];
      for (const [codigo, pos] of novas.entries()) {
        updates.push(
          supabase.from("organograma_manutencao_areas")
            .update({ canvas_x: pos.x, canvas_y: pos.y })
            .eq("codigo", codigo)
        );
      }
      const results = await Promise.all(updates);
      const err = results.find((r) => r.error)?.error;
      if (err) throw err;
      dirtyRef.current.clear();
      await carregar();
      // Reseta o fitView do reactflow
      if (reactFlowInstance.current) {
        setTimeout(() => reactFlowInstance.current?.fitView({ padding: 0.2 }), 100);
      }
      setStatusMsg("Organograma reorganizado.");
    } catch (error) {
      console.error(error);
      alert(error?.message || "Nao foi possivel organizar.");
    } finally {
      setSaving(false);
    }
  }

  async function salvarPosicoes() {
    if (!dirtyRef.current.size) {
      setStatusMsg("Nada para salvar.");
      return;
    }
    setSaving(true);
    setStatusMsg("");
    try {
      const updates = [];
      for (const [codigo, pos] of dirtyRef.current.entries()) {
        updates.push(supabase.from("organograma_manutencao_areas").update({ canvas_x: pos.x, canvas_y: pos.y }).eq("codigo", codigo));
      }
      const results = await Promise.all(updates);
      const err = results.find((r) => r.error)?.error;
      if (err) throw err;
      dirtyRef.current.clear();
      setStatusMsg("Layout salvo.");
    } catch (error) {
      console.error(error);
      alert(error?.message || "Nao foi possivel salvar o layout.");
    } finally {
      setSaving(false);
    }
  }

  async function criarArea(payload) {
    setSaving(true);
    try {
      const baseSlug = slugify(payload.titulo) || "area";
      // Sempre adiciona um sufixo unico para nao colidir com areas soft-deletadas
      // (a constraint unique vale para a tabela toda, nao so as ativas).
      const suffix = Date.now().toString(36).slice(-5);
      let codigo = `${baseSlug}_${suffix}`;
      // Confere se ja existe (qualquer ativo/inativo) e adiciona random extra se precisar
      const { data: existentes } = await supabase
        .from("organograma_manutencao_areas")
        .select("codigo")
        .eq("codigo", codigo);
      if (existentes && existentes.length) {
        codigo = `${codigo}_${Math.random().toString(36).slice(2, 6)}`;
      }
      // Posicao: centro do viewport atual
      let pos = { x: 0, y: 0 };
      if (reactFlowInstance.current) {
        const { x, y, zoom } = reactFlowInstance.current.getViewport();
        const w = window.innerWidth;
        const h = window.innerHeight;
        pos = { x: (-x + w / 2) / zoom - 120, y: (-y + h / 2) / zoom - 70 };
      }
      const insert = {
        codigo,
        parent_codigo: payload.parent_codigo,
        titulo: payload.titulo,
        subtitulo: payload.subtitulo,
        tipo: payload.tipo,
        nivel: payload.nivel,
        setor: payload.setor,
        cor: payload.cor,
        ordem: (areas.reduce((acc, a) => Math.max(acc, a.ordem || 0), 0) || 0) + 10,
        ativo: true,
        orcado_qtd: payload.orcado_qtd,
        canvas_x: pos.x,
        canvas_y: pos.y,
      };
      const { error } = await supabase.from("organograma_manutencao_areas").insert([insert]);
      if (error) throw error;
      setNovaOpen(false);
      await carregar();
      setSelecionadoId(codigo);
    } catch (error) {
      console.error(error);
      alert(error?.message || "Nao foi possivel criar a caixa.");
    } finally {
      setSaving(false);
    }
  }

  async function atualizarArea(codigo, patch) {
    setSaving(true);
    try {
      const { error } = await supabase.from("organograma_manutencao_areas").update(patch).eq("codigo", codigo);
      if (error) throw error;
      await carregar();
    } catch (error) {
      console.error(error);
      alert(error?.message || "Nao foi possivel salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function excluirArea(codigo) {
    setSaving(true);
    try {
      // Soft delete via ativo=false; promove filhos para o pai do removido
      const removida = areasByCode.get(codigo);
      const filhos = (childrenMap.get(codigo) || []).map((c) => c.codigo);
      const promoteParent = removida?.parent_codigo || null;
      const updates = [
        supabase.from("organograma_manutencao_areas").update({ ativo: false }).eq("codigo", codigo),
      ];
      for (const f of filhos) {
        updates.push(supabase.from("organograma_manutencao_areas").update({ parent_codigo: promoteParent }).eq("codigo", f));
      }
      const results = await Promise.all(updates);
      const err = results.find((r) => r.error)?.error;
      if (err) throw err;
      setSelecionadoId(null);
      await carregar();
    } catch (error) {
      console.error(error);
      alert(error?.message || "Nao foi possivel excluir.");
    } finally {
      setSaving(false);
    }
  }

  async function addVagaOrcada(areaAlvo, cargo) {
    if (!areaAlvo || !cargo) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("organograma_manutencao_pessoas").insert([{
        area_codigo: areaAlvo.codigo,
        nome: "",
        cargo,
        tipo_headcount: "ORCADO",
        ativo: true,
      }]);
      if (error) throw error;
      await carregar();
      setStatusMsg("Vaga orcada adicionada.");
    } catch (error) {
      console.error(error);
      alert(error?.message || "Nao foi possivel adicionar a vaga.");
    } finally {
      setSaving(false);
    }
  }

  async function addRealizado(areaAlvo, funcionario, vagaPessoaIdParaSubstituir) {
    if (!areaAlvo || !funcionario) return;
    const key = buildFuncionarioKey(funcionario);
    const aloc = alocacoesPorFuncId.get(key);
    if (aloc && aloc.pessoaId !== vagaPessoaIdParaSubstituir) {
      const titulo = allAreasByCode.get(aloc.area_codigo)?.titulo || aloc.area_codigo;
      alert(`Esse funcionario ja esta alocado em "${titulo}". Remova de la primeiro.`);
      return;
    }
    setSaving(true);
    try {
      if (vagaPessoaIdParaSubstituir) {
        const { error } = await supabase
          .from("organograma_manutencao_pessoas")
          .update({
            area_codigo: areaAlvo.codigo,
            nome: funcionario.nm_funcionario || "",
            cargo: funcionario.nm_funcao || "",
            funcionario_id: String(funcionario.id_funcionario || ""),
            funcionario_cracha: String(funcionario.nr_cracha || ""),
            tipo_headcount: "REALIZADO",
            ativo: true,
          })
          .eq("id", vagaPessoaIdParaSubstituir);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("organograma_manutencao_pessoas").insert([{
          area_codigo: areaAlvo.codigo,
          nome: funcionario.nm_funcionario || "",
          cargo: funcionario.nm_funcao || "",
          funcionario_id: String(funcionario.id_funcionario || ""),
          funcionario_cracha: String(funcionario.nr_cracha || ""),
          tipo_headcount: "REALIZADO",
          ativo: true,
        }]);
        if (error) throw error;
      }
      await carregar();
      setStatusMsg("Pessoa alocada.");
    } catch (error) {
      console.error(error);
      alert(error?.message || "Nao foi possivel alocar.");
    } finally {
      setSaving(false);
    }
  }

  async function editarPessoa(pessoaId, patch) {
    setSaving(true);
    try {
      const { error } = await supabase.from("organograma_manutencao_pessoas").update(patch).eq("id", pessoaId);
      if (error) throw error;
      await carregar();
    } catch (error) {
      console.error(error);
      alert(error?.message || "Nao foi possivel salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function removerPessoa(pessoaId) {
    setSaving(true);
    try {
      const { error } = await supabase.from("organograma_manutencao_pessoas").update({ ativo: false }).eq("id", pessoaId);
      if (error) throw error;
      await carregar();
    } catch (error) {
      console.error(error);
      alert(error?.message || "Nao foi possivel remover.");
    } finally {
      setSaving(false);
    }
  }

  async function importarFuncoesComoOrcado(funcoesList) {
    if (!puxarFuncoesArea || !funcoesList?.length) return;
    setSaving(true);
    try {
      const rows = funcoesList.map((funcao) => ({
        area_codigo: puxarFuncoesArea.codigo,
        nome: "",
        cargo: funcao,
        tipo_headcount: "ORCADO",
        ativo: true,
      }));
      const { error } = await supabase.from("organograma_manutencao_pessoas").insert(rows);
      if (error) throw error;
      setPuxarFuncoesArea(null);
      await carregar();
      setStatusMsg(`${rows.length} vaga(s) importada(s) como orcado.`);
    } catch (error) {
      console.error(error);
      alert(error?.message || "Nao foi possivel importar as funcoes.");
    } finally {
      setSaving(false);
    }
  }

  async function importarFuncionariosComoRealizado(funcoesList) {
    if (!puxarFuncoesArea || !funcoesList?.length) return;
    setSaving(true);
    try {
      const selecionadas = new Set(funcoesList.map((item) => String(item || "").trim()).filter(Boolean));
      const candidatos = funcionarios.filter((f) => selecionadas.has(String(f.nm_funcao || "").trim()));
      const rows = [];
      let ignorados = 0;

      for (const funcionario of candidatos) {
        const key = buildFuncionarioKey(funcionario);
        if (!key) {
          ignorados += 1;
          continue;
        }
        if (alocacoesPorFuncId.get(key)) {
          ignorados += 1;
          continue;
        }
        rows.push({
          area_codigo: puxarFuncoesArea.codigo,
          nome: funcionario.nm_funcionario || "",
          cargo: funcionario.nm_funcao || "",
          funcionario_id: String(funcionario.id_funcionario || ""),
          funcionario_cracha: String(funcionario.nr_cracha || ""),
          tipo_headcount: "REALIZADO",
          ativo: true,
        });
      }

      if (!rows.length) {
        alert("Nenhum funcionario disponivel para puxar. Os selecionados ja podem estar alocados em outras areas.");
        return;
      }

      const { error } = await supabase.from("organograma_manutencao_pessoas").insert(rows);
      if (error) throw error;
      setPuxarFuncoesArea(null);
      await carregar();
      setStatusMsg(`${rows.length} pessoa(s) puxada(s) para a area.${ignorados ? ` ${ignorados} ja estavam alocada(s) e foram ignorada(s).` : ""}`);
    } catch (error) {
      console.error(error);
      alert(error?.message || "Nao foi possivel puxar as pessoas.");
    } finally {
      setSaving(false);
    }
  }

  async function onNodeDragStop(_, node) {
    // Salva posicao do node arrastado
    dirtyRef.current.set(node.id, { x: node.position.x, y: node.position.y });

    // Detecta reparent: se o node soltado esta dentro do bbox de outro node, vira filho dele
    const draggedId = node.id;
    const dragged = node;
    // tamanho aproximado do card 260x150
    const cx = dragged.position.x + 130;
    const cy = dragged.position.y + 75;
    let novoPaiId = null;
    for (const n of nodes) {
      if (n.id === draggedId) continue;
      const w = (n.width || 260);
      const h = (n.height || 150);
      const x1 = n.position.x;
      const y1 = n.position.y;
      const x2 = x1 + w;
      const y2 = y1 + h;
      if (cx >= x1 && cx <= x2 && cy >= y1 && cy <= y2) {
        novoPaiId = n.id;
        break;
      }
    }
    if (!novoPaiId) return;
    if (novoPaiId === draggedId) return;
    const atual = areasByCode.get(draggedId);
    if (!atual) return;
    if (atual.parent_codigo === novoPaiId) return;
    // Evita ciclo: o novo pai nao pode estar entre os descendentes do dragged
    const desc = collectDescendantCodes(draggedId, childrenMap);
    if (desc.has(novoPaiId)) {
      alert("Nao da pra colocar uma area sob um descendente dela.");
      return;
    }
    const titulo = areasByCode.get(novoPaiId)?.titulo || novoPaiId;
    if (!confirm(`Mover "${atual.titulo}" para ficar sob "${titulo}"?`)) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("organograma_manutencao_areas")
        .update({ parent_codigo: novoPaiId })
        .eq("codigo", draggedId);
      if (error) throw error;
      await carregar();
      setStatusMsg("Hierarquia atualizada.");
    } catch (error) {
      console.error(error);
      alert(error?.message || "Nao foi possivel reparentar.");
    } finally {
      setSaving(false);
    }
  }

  async function exportarPNG() {
    const alvo = document.querySelector(".react-flow");
    if (!alvo) return;
    setExportando(true);
    try {
      const canvas = await html2canvas(alvo, { backgroundColor: "#f8fafc", scale: 2, useCORS: true, logging: false });
      const dataUrl = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.download = `organograma_${new Date().toISOString().slice(0, 10)}.png`;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error(error);
      alert("Nao foi possivel exportar a imagem.");
    } finally {
      setExportando(false);
    }
  }

  async function exportarPDF() {
    const alvo = document.querySelector(".react-flow");
    if (!alvo) return;
    setExportando(true);
    try {
      const canvas = await html2canvas(alvo, { backgroundColor: "#f8fafc", scale: 2, useCORS: true, logging: false });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: canvas.width >= canvas.height ? "landscape" : "portrait",
        unit: "pt",
        format: [canvas.width, canvas.height],
      });
      pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height);
      pdf.save(`organograma_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (error) {
      console.error(error);
      alert("Nao foi possivel exportar o PDF.");
    } finally {
      setExportando(false);
    }
  }

  function exportarExcel() {
    if (!areasFiltradas.length) {
      alert("Nenhuma area para exportar.");
      return;
    }
    const linhas = [];
    for (const a of areasFiltradas) {
      const m = computeMetrics(a, pessoas, childrenMap);
      const pessoasArea = pessoas.filter((p) => p.area_codigo === a.codigo);
      const realizadas = pessoasArea.filter((p) => p.tipo_headcount === "REALIZADO");
      const orcadasCadastradas = pessoasArea.filter((p) => p.tipo_headcount === "ORCADO");
      const freelancers = pessoasArea.filter((p) => p.tipo_headcount === "FREELANCER");

      // Constroi as vagas (espelha logica do painel)
      const orcadoQtd = m.directOrcado;
      const slots = orcadasCadastradas.map((p) => ({
        cargoOrcado: p.cargo || "Vaga planejada",
        nomeOrcado: p.nome || "",
        preenchida: false,
        nomeRealizado: "",
        cargoRealizado: "",
      }));
      while (slots.length < orcadoQtd) {
        slots.push({ cargoOrcado: "Vaga planejada", nomeOrcado: "", preenchida: false, nomeRealizado: "", cargoRealizado: "" });
      }
      realizadas.forEach((p, idx) => {
        if (idx >= slots.length) {
          slots.push({ cargoOrcado: p.cargo || "", nomeOrcado: "", preenchida: true, nomeRealizado: p.nome || "", cargoRealizado: p.cargo || "" });
        } else {
          slots[idx].preenchida = true;
          slots[idx].nomeRealizado = p.nome || "";
          slots[idx].cargoRealizado = p.cargo || "";
          if (!slots[idx].cargoOrcado || slots[idx].cargoOrcado === "Vaga planejada") {
            slots[idx].cargoOrcado = p.cargo || slots[idx].cargoOrcado;
          }
        }
      });

      const setorLabel = SETOR_LABELS[a.setor] || "";
      const nivelLabel = NIVEL_BY_VALUE.get(a.nivel)?.label || a.nivel || "";
      const pai = areasByCode.get(a.parent_codigo)?.titulo || "";

      if (!slots.length && !freelancers.length) {
        linhas.push({
          Setor: setorLabel,
          Area: a.titulo,
          "Area pai": pai,
          Nivel: nivelLabel,
          Tipo: a.tipo || "",
          "Funcao Orcada": "",
          "Nome Orcado": "",
          Status: "Sem vagas",
          "Funcao Realizada": "",
          "Nome Realizado": "",
          "Data Admissao": "",
          "Tempo Empresa": "",
        });
        continue;
      }

      for (const s of slots) {
        const func = s.preenchida ? funcByNome.get(normalizeNome(s.nomeRealizado)) : null;
        linhas.push({
          Setor: setorLabel,
          Area: a.titulo,
          "Area pai": pai,
          Nivel: nivelLabel,
          Tipo: a.tipo || "",
          "Funcao Orcada": s.cargoOrcado || "",
          "Nome Orcado": s.nomeOrcado || "",
          Status: s.preenchida ? "Preenchida" : "Em aberto",
          "Funcao Realizada": s.cargoRealizado || "",
          "Nome Realizado": s.nomeRealizado || "",
          "Data Admissao": func?.dt_inicio_atividade ? new Date(func.dt_inicio_atividade).toLocaleDateString("pt-BR") : "",
          "Tempo Empresa": func ? calcTempoEmpresa(func.dt_inicio_atividade) : "",
        });
      }

      for (const fl of freelancers) {
        const func = funcByNome.get(normalizeNome(fl.nome));
        linhas.push({
          Setor: setorLabel,
          Area: a.titulo,
          "Area pai": pai,
          Nivel: nivelLabel,
          Tipo: a.tipo || "",
          "Funcao Orcada": fl.cargo || "Freelancer",
          "Nome Orcado": "",
          Status: "Freelancer",
          "Funcao Realizada": fl.cargo || "",
          "Nome Realizado": fl.nome || "",
          "Data Admissao": func?.dt_inicio_atividade ? new Date(func.dt_inicio_atividade).toLocaleDateString("pt-BR") : "",
          "Tempo Empresa": func ? calcTempoEmpresa(func.dt_inicio_atividade) : "",
        });
      }
    }

    const ws = XLSX.utils.json_to_sheet(linhas);
    // ajusta largura das colunas
    ws["!cols"] = [
      { wch: 22 }, { wch: 28 }, { wch: 22 }, { wch: 14 }, { wch: 12 },
      { wch: 28 }, { wch: 22 }, { wch: 12 }, { wch: 28 }, { wch: 28 },
      { wch: 14 }, { wch: 18 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Organograma");
    const nome = `organograma_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, nome);
  }

  const selecionada = selecionadoId ? areasByCode.get(selecionadoId) : null;
  const stats = useMemo(() => ({ areas: areas.length, pessoas: pessoas.length }), [areas, pessoas]);

  return (
    <div className="flex h-[calc(100vh-90px)] flex-col gap-3 p-3 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-blue-600">Pessoas · Organograma</div>
          <h1 className="text-2xl font-black text-slate-900 md:text-3xl">Organograma · Canvas</h1>
          <p className="text-sm text-slate-500">
            Tela infinita. Crie caixas, arraste, conecte e clique para ver pessoas, orcado x realizado e cascata.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm">
            {stats.areas} area(s) · {stats.pessoas} pessoa(s)
          </div>
          <button type="button" onClick={() => setEntenderOpen(true)} className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm font-bold text-blue-700 shadow-sm hover:bg-blue-50">
            <FaQuestionCircle /> Entender
          </button>
          <button type="button" onClick={() => setQuadroOpen(true)} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-sm font-bold text-white shadow hover:bg-slate-800">
            <FaUserFriends /> Quadro
          </button>
          <button type="button" onClick={() => setNovaOpen(true)} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-bold text-white shadow hover:bg-emerald-700">
            <FaPlus /> Nova caixa
          </button>
          <button type="button" onClick={carregar} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60">
            <FaSync /> Recarregar
          </button>
          <button type="button" onClick={organizarOrganograma} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-3 py-2 text-sm font-bold text-white shadow hover:bg-purple-700 disabled:opacity-60">
            <FaSitemap /> Organizar
          </button>
          <button type="button" onClick={salvarPosicoes} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow hover:bg-blue-700 disabled:opacity-60">
            <FaSave /> {saving ? "Salvando..." : "Salvar layout"}
          </button>
          <div className="flex overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <button type="button" onClick={exportarPNG} disabled={exportando} className="inline-flex items-center gap-2 border-r border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">
              <FaFileImage /> PNG
            </button>
            <button type="button" onClick={exportarPDF} disabled={exportando} className="inline-flex items-center gap-2 border-r border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">
              <FaFilePdf /> PDF
            </button>
            <button type="button" onClick={exportarExcel} className="inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50">
              <FaFileExcel /> Excel
            </button>
          </div>
        </div>
      </div>

      {statusMsg ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">{statusMsg}</div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setSetorFiltro("")}
          className={`rounded-xl border px-3 py-2 text-sm font-bold transition ${
            !setorFiltro ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
          }`}
        >
          Visao geral
        </button>
        {SETORES.map((s) => (
          <button
            key={s.value}
            type="button"
            onClick={() => setSetorFiltro(s.value)}
            className={`rounded-xl border px-3 py-2 text-sm font-bold transition ${
              setorFiltro === s.value ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-[11px]">
        <div className="font-black uppercase tracking-[0.18em] text-slate-500">Legenda de niveis</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {NIVEIS.map((n) => {
            const cor = pickCor(n.cor);
            return (
              <span key={n.value} className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 ${cor.chip}`}>
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: cor.hex }} />
                {n.label}
              </span>
            );
          })}
        </div>
      </div>

      <div className="relative flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-sm">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={handleNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeDragStop={onNodeDragStop}
          onNodeClick={(_, n) => setSelecionadoId(n.id)}
          onPaneClick={() => setSelecionadoId(null)}
          onInit={(instance) => (reactFlowInstance.current = instance)}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.2}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={20} size={1} color="#cbd5e1" />
          <Controls position="bottom-right" showInteractive={false} />
          <MiniMap pannable zoomable nodeColor={(n) => pickCor(n.data?.corKey).hex} />
        </ReactFlow>

        {selecionada ? (
          <SidePanel
            area={selecionada}
            areas={areas}
            pessoas={pessoas}
            childrenMap={childrenMap}
            funcByNome={funcByNome}
            onPuxarFuncoes={(a) => setPuxarFuncoesArea(a)}
            onAddVaga={addVagaOrcada}
            onAbrirPicker={(ctx) => setPickerContext(ctx)}
            onEditarPessoa={editarPessoa}
            onRemoverPessoa={removerPessoa}
            onClose={() => setSelecionadoId(null)}
            onSave={atualizarArea}
            onDelete={excluirArea}
            saving={saving}
          />
        ) : null}
      </div>

      <NovaAreaModal
        open={novaOpen}
        areas={areas}
        defaultSetor={setorFiltro || ""}
        onClose={() => setNovaOpen(false)}
        onCreate={criarArea}
        saving={saving}
      />

      <EntenderModal
        open={entenderOpen}
        onClose={() => setEntenderOpen(false)}
        areas={areas}
        childrenMap={childrenMap}
      />

      <PuxarFuncoesModal
        open={!!puxarFuncoesArea}
        area={puxarFuncoesArea}
        funcionarios={funcionarios}
        alocacoesPorFuncId={alocacoesPorFuncId}
        areasByCode={allAreasByCode}
        onClose={() => setPuxarFuncoesArea(null)}
        onImportOrcado={importarFuncoesComoOrcado}
        onImportRealizado={importarFuncionariosComoRealizado}
        saving={saving}
      />

      <PessoaPickerModal
        open={!!pickerContext}
        contexto={pickerContext ? {
          titulo: pickerContext.areaAlvo ? `Alocar em "${pickerContext.areaAlvo.titulo}"` : "Alocar pessoa",
          subtitulo: pickerContext.areaAlvo?.subtitulo,
          pessoaIdAtual: pickerContext.pessoaIdAtual,
        } : null}
        funcionarios={funcionarios}
        alocacoesPorFuncId={alocacoesPorFuncId}
        areasByCode={allAreasByCode}
        onClose={() => setPickerContext(null)}
        onPick={async (f) => {
          if (!pickerContext) return;
          await addRealizado(pickerContext.areaAlvo, f, pickerContext.pessoaIdAtual);
          setPickerContext(null);
        }}
        saving={saving}
      />

      <QuadroDrawer
        open={quadroOpen}
        onClose={() => setQuadroOpen(false)}
        funcionarios={funcionarios}
        pessoas={pessoas}
        areas={areas}
        alocacoesPorFuncId={alocacoesPorFuncId}
        areasByCode={allAreasByCode}
        onAlocar={(f) => {
          // Abre escolha de area
          const titulos = areas.map((a) => `${a.codigo}: ${a.titulo}`).join("\n");
          const escolha = prompt(`Em qual area alocar "${f.nm_funcionario}"?\n\nDigite o codigo da area exatamente como esta na lista:\n\n${titulos}`, "");
          if (!escolha) return;
          const area = areas.find((a) => a.codigo === escolha.trim());
          if (!area) {
            alert("Codigo de area nao encontrado.");
            return;
          }
          setQuadroOpen(false);
          addRealizado(area, f);
        }}
      />
    </div>
  );
}
