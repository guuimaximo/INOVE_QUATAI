import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
} from "react-icons/fa";

import { supabase } from "../../supabase";

const CORES = {
  stone: { label: "Neutro", border: "border-slate-300", bg: "bg-white", chip: "bg-slate-100 text-slate-700", hex: "#94a3b8" },
  emerald: { label: "Verde", border: "border-emerald-300", bg: "bg-emerald-50", chip: "bg-emerald-100 text-emerald-700", hex: "#10b981" },
  blue: { label: "Azul", border: "border-blue-300", bg: "bg-blue-50", chip: "bg-blue-100 text-blue-700", hex: "#3b82f6" },
  amber: { label: "Amarelo", border: "border-amber-300", bg: "bg-amber-50", chip: "bg-amber-100 text-amber-700", hex: "#f59e0b" },
  sky: { label: "Ceu", border: "border-sky-300", bg: "bg-sky-50", chip: "bg-sky-100 text-sky-700", hex: "#0ea5e9" },
  orange: { label: "Laranja", border: "border-orange-300", bg: "bg-orange-50", chip: "bg-orange-100 text-orange-700", hex: "#f97316" },
};
const COR_OPTIONS = Object.keys(CORES);

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
  const cor = pickCor(data.cor);
  const orcado = Number(data.orcado_total || 0);
  const realizado = Number(data.realizado_total || 0);
  const cobertura = orcado > 0 ? Math.min(100, Math.round((realizado / orcado) * 100)) : 0;
  return (
    <div
      className={`min-w-[220px] max-w-[280px] rounded-2xl border-2 ${cor.border} ${cor.bg} p-3 shadow-sm transition ${
        selected ? "ring-2 ring-blue-500 ring-offset-2" : ""
      }`}
    >
      <Handle type="target" position={Position.Top} className="!h-2 !w-2 !bg-slate-400" />
      <div className="flex items-center justify-between gap-2">
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${cor.chip}`}>
          {data.tipo || "AREA"}
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

function autoLayout(areas) {
  const children = new Map();
  for (const a of areas) {
    const p = a.parent_codigo || null;
    if (!children.has(p)) children.set(p, []);
    children.get(p).push(a);
  }
  for (const [, list] of children) list.sort((x, y) => (x.ordem || 0) - (y.ordem || 0));

  const positions = new Map();
  const wLeaf = 260;
  const hLevel = 200;

  function place(codigo, level, leftLeafOffset) {
    const kids = children.get(codigo) || [];
    if (!kids.length) {
      positions.set(codigo, { x: leftLeafOffset * wLeaf, y: level * hLevel });
      return 1;
    }
    let consumed = 0;
    const ranges = [];
    for (const k of kids) {
      const w = place(k.codigo, level + 1, leftLeafOffset + consumed);
      ranges.push({ start: leftLeafOffset + consumed, width: w });
      consumed += w;
    }
    const start = ranges[0].start;
    const end = ranges[ranges.length - 1].start + ranges[ranges.length - 1].width - 1;
    positions.set(codigo, { x: ((start + end) / 2) * wLeaf, y: level * hLevel });
    return consumed;
  }

  let offset = 0;
  for (const r of (children.get(null) || [])) {
    const w = countLeaves(r.codigo, children);
    place(r.codigo, 0, offset);
    offset += w;
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

function NovaAreaModal({ open, areas, onClose, onCreate, saving }) {
  const [titulo, setTitulo] = useState("");
  const [subtitulo, setSubtitulo] = useState("");
  const [parentCodigo, setParentCodigo] = useState("");
  const [tipo, setTipo] = useState("SQUAD");
  const [cor, setCor] = useState("blue");
  const [orcadoQtd, setOrcadoQtd] = useState("");

  useEffect(() => {
    if (open) {
      setTitulo("");
      setSubtitulo("");
      setParentCodigo("");
      setTipo("SQUAD");
      setCor("blue");
      setOrcadoQtd("");
    }
  }, [open]);

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
          <FormField label="Titulo">
            <input className={inputCls()} value={titulo} onChange={(e) => setTitulo(e.target.value)} autoFocus />
          </FormField>
          <FormField label="Subtitulo">
            <input className={inputCls()} value={subtitulo} onChange={(e) => setSubtitulo(e.target.value)} />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Tipo">
              <select className={inputCls()} value={tipo} onChange={(e) => setTipo(e.target.value)}>
                {TIPO_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </FormField>
            <FormField label="Cor">
              <select className={inputCls()} value={cor} onChange={(e) => setCor(e.target.value)}>
                {COR_OPTIONS.map((c) => <option key={c} value={c}>{CORES[c].label}</option>)}
              </select>
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Area pai (opcional)">
              <select className={inputCls()} value={parentCodigo} onChange={(e) => setParentCodigo(e.target.value)}>
                <option value="">Sem pai (raiz)</option>
                {areas.map((a) => <option key={a.codigo} value={a.codigo}>{a.titulo}</option>)}
              </select>
            </FormField>
            <FormField label="Orcado de pessoas">
              <input
                type="number"
                min="0"
                className={inputCls()}
                value={orcadoQtd}
                onChange={(e) => setOrcadoQtd(e.target.value)}
              />
            </FormField>
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200">
            Cancelar
          </button>
          <button
            type="button"
            disabled={saving || !titulo.trim()}
            onClick={() => onCreate({ titulo: titulo.trim(), subtitulo: subtitulo.trim(), parent_codigo: parentCodigo || null, tipo, cor, orcado_qtd: orcadoQtd === "" ? null : Number(orcadoQtd) })}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            <FaPlus /> {saving ? "Criando..." : "Criar caixa"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SidePanel({ area, areas, pessoas, childrenMap, onClose, onSave, onDelete, saving }) {
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
    // Comeca com as vagas orcadas cadastradas explicitamente (com nome/cargo)
    const lista = pessoasOrcadasCadastradas.map((p, idx) => ({
      id: p.id,
      label: p.nome || `Vaga ${idx + 1}`,
      cargo: p.cargo,
      preenchida: false,
    }));
    // Marca como preenchida na ordem em que pessoas REALIZADO existem
    for (let i = 0; i < Math.min(lista.length, pessoasRealizadas.length); i += 1) {
      lista[i].preenchida = true;
      lista[i].label = pessoasRealizadas[i].nome || lista[i].label;
      lista[i].cargo = pessoasRealizadas[i].cargo || lista[i].cargo;
    }
    // Completa ate atingir orcadoQtd com vagas em aberto
    while (lista.length < orcadoQtd) {
      const idx = lista.length;
      const real = pessoasRealizadas[idx];
      lista.push({
        id: real?.id || `vaga-aberta-${idx}`,
        label: real?.nome || `Vaga em aberto ${idx + 1}`,
        cargo: real?.cargo,
        preenchida: !!real,
      });
    }
    return lista;
  })();
  const subAreas = childrenMap.get(area.codigo) || [];
  const desc = collectDescendantCodes(area.codigo, childrenMap);

  function startEdit() {
    setDraft({
      titulo: area.titulo || "",
      subtitulo: area.subtitulo || "",
      tipo: area.tipo || "SQUAD",
      cor: area.cor || "stone",
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
      cor: draft.cor,
      parent_codigo: draft.parent_codigo || null,
      orcado_qtd: draft.orcado_qtd === "" || draft.orcado_qtd == null ? null : Number(draft.orcado_qtd),
    });
    setEditing(false);
  }

  return (
    <div className="absolute right-0 top-0 z-30 flex h-full w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-2xl">
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
              <FormField label="Tipo">
                <select className={inputCls()} value={draft.tipo} onChange={(e) => setDraftField("tipo", e.target.value)}>
                  {TIPO_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </FormField>
              <FormField label="Cor">
                <select className={inputCls()} value={draft.cor} onChange={(e) => setDraftField("cor", e.target.value)}>
                  {COR_OPTIONS.map((c) => <option key={c} value={c}>{CORES[c].label}</option>)}
                </select>
              </FormField>
            </div>
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

        {/* Orcado x Realizado */}
        <div className="grid grid-cols-1 gap-3">
          <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-black uppercase tracking-wide text-amber-800">
                Orcado · vagas planejadas ({vagasOrcadas.length})
              </div>
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">
                {pessoasArea.filter((p) => p.tipo_headcount === "REALIZADO").length}/{vagasOrcadas.length} preenchidas
              </span>
            </div>
            <p className="mt-1 text-[11px] text-amber-700">
              Quantidade de vagas que o organograma reserva para esta area.
            </p>
            {vagasOrcadas.length ? (
              <div className="mt-2 space-y-1.5">
                {vagasOrcadas.map((vaga, idx) => (
                  <div key={vaga.id || `vaga-${idx}`} className="flex items-center justify-between rounded-xl bg-white px-3 py-2 shadow-sm">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold text-slate-800">
                        {vaga.label}
                      </div>
                      {vaga.cargo ? <div className="text-[11px] text-slate-500">{vaga.cargo}</div> : null}
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                      vaga.preenchida ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                    }`}>
                      {vaga.preenchida ? "Preenchida" : "Em aberto"}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-2 text-xs text-amber-700">Nenhuma vaga orcada definida.</div>
            )}
          </div>

          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-3">
            <button type="button" onClick={() => setPessoasAbertas((v) => !v)} className="flex w-full items-center justify-between text-left">
              <div className="text-sm font-black uppercase tracking-wide text-emerald-800">
                Realizado · quem esta nessas vagas ({pessoasRealizadas.length})
              </div>
              {pessoasAbertas ? <FaChevronDown className="text-emerald-500" /> : <FaChevronRight className="text-emerald-500" />}
            </button>
            <p className="mt-1 text-[11px] text-emerald-700">
              Pessoas alocadas hoje cobrindo as vagas orcadas desta area.
            </p>
            {pessoasAbertas ? (
              pessoasRealizadas.length ? (
                <div className="mt-2 space-y-1.5">
                  {pessoasRealizadas.map((p) => (
                    <div key={p.id} className="flex items-center justify-between rounded-xl bg-white px-3 py-2 shadow-sm">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-bold text-slate-800">{p.nome || "(sem nome)"}</div>
                        <div className="text-[11px] text-slate-500">{p.cargo || "-"}</div>
                      </div>
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                        Ativo
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-2 text-xs text-emerald-700">Nenhuma pessoa alocada nesta area ainda.</div>
              )
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function OrganogramaCanvas() {
  const [areas, setAreas] = useState([]);
  const [pessoas, setPessoas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [novaOpen, setNovaOpen] = useState(false);
  const [entenderOpen, setEntenderOpen] = useState(false);
  const [selecionadoId, setSelecionadoId] = useState(null);
  const [statusMsg, setStatusMsg] = useState("");
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const dirtyRef = useRef(new Map());
  const reactFlowInstance = useRef(null);

  async function carregar() {
    setLoading(true);
    const [areasResp, pessoasResp] = await Promise.all([
      supabase.from("organograma_manutencao_areas").select("*").eq("ativo", true),
      supabase.from("organograma_manutencao_pessoas").select("*").eq("ativo", true),
    ]);
    setLoading(false);
    if (areasResp.error || pessoasResp.error) {
      console.error(areasResp.error || pessoasResp.error);
      alert("Nao foi possivel carregar o organograma.");
      return;
    }
    setAreas(areasResp.data || []);
    setPessoas(pessoasResp.data || []);
  }

  useEffect(() => { carregar(); }, []);

  const childrenMap = useMemo(() => buildChildrenMap(areas), [areas]);
  const areasByCode = useMemo(() => new Map(areas.map((a) => [a.codigo, a])), [areas]);

  useEffect(() => {
    // Expose por window pra computeMetrics conseguir ler orcado por area
    window.__ORG_AREAS_BY_CODE__ = areasByCode;
  }, [areasByCode]);

  useEffect(() => {
    if (!areas.length) {
      setNodes([]);
      setEdges([]);
      return;
    }
    const auto = autoLayout(areas);
    const newNodes = areas.map((a) => {
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
          cor: a.cor,
          orcado_direto: m.directOrcado,
          realizado_direto: m.directRealizado,
          orcado_total: m.totalOrcado,
          realizado_total: m.totalRealizado,
          descendentes: m.descendentes,
        },
      };
    });
    const newEdges = areas
      .filter((a) => a.parent_codigo)
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
  }, [areas, pessoas, childrenMap, setEdges, setNodes]);

  const onConnect = useCallback((params) => setEdges((eds) => addEdge({ ...params, type: "smoothstep" }, eds)), [setEdges]);

  function handleNodesChange(changes) {
    onNodesChange(changes);
    for (const c of changes) {
      if (c.type === "position" && c.position && !c.dragging) {
        dirtyRef.current.set(c.id, { x: c.position.x, y: c.position.y });
      }
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
      let codigo = slugify(payload.titulo);
      if (!codigo) codigo = `area_${Date.now()}`;
      if (areasByCode.has(codigo)) codigo = `${codigo}_${Date.now().toString(36).slice(-4)}`;
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
          <button type="button" onClick={() => setNovaOpen(true)} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-bold text-white shadow hover:bg-emerald-700">
            <FaPlus /> Nova caixa
          </button>
          <button type="button" onClick={carregar} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60">
            <FaSync /> Recarregar
          </button>
          <button type="button" onClick={salvarPosicoes} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow hover:bg-blue-700 disabled:opacity-60">
            <FaSave /> {saving ? "Salvando..." : "Salvar layout"}
          </button>
        </div>
      </div>

      {statusMsg ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">{statusMsg}</div>
      ) : null}

      <div className="relative flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-sm">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={handleNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
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
          <MiniMap pannable zoomable nodeColor={(n) => pickCor(n.data?.cor).hex} />
        </ReactFlow>

        {selecionada ? (
          <SidePanel
            area={selecionada}
            areas={areas}
            pessoas={pessoas}
            childrenMap={childrenMap}
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
    </div>
  );
}
