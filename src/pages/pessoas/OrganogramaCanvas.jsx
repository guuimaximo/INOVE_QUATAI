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
import { FaSave, FaSync, FaSitemap, FaUsers } from "react-icons/fa";

import { supabase } from "../../supabase";

const CORES = {
  stone: { border: "border-slate-300", bg: "bg-white", chip: "bg-slate-100 text-slate-700" },
  emerald: { border: "border-emerald-300", bg: "bg-emerald-50", chip: "bg-emerald-100 text-emerald-700" },
  blue: { border: "border-blue-300", bg: "bg-blue-50", chip: "bg-blue-100 text-blue-700" },
  amber: { border: "border-amber-300", bg: "bg-amber-50", chip: "bg-amber-100 text-amber-700" },
  sky: { border: "border-sky-300", bg: "bg-sky-50", chip: "bg-sky-100 text-sky-700" },
  orange: { border: "border-orange-300", bg: "bg-orange-50", chip: "bg-orange-100 text-orange-700" },
};

function pickCor(key) {
  return CORES[key] || CORES.stone;
}

function AreaNode({ data }) {
  const cor = pickCor(data.cor);
  return (
    <div className={`min-w-[220px] max-w-[280px] rounded-2xl border-2 ${cor.border} ${cor.bg} p-3 shadow-sm`}>
      <Handle type="target" position={Position.Top} className="!h-2 !w-2 !bg-slate-400" />
      <div className="flex items-center gap-2">
        <FaSitemap className="text-slate-500" />
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${cor.chip}`}>
          {data.tipo || "AREA"}
        </span>
      </div>
      <div className="mt-2 text-sm font-black text-slate-900">{data.titulo}</div>
      {data.subtitulo ? <div className="text-xs text-slate-600">{data.subtitulo}</div> : null}
      <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
        <span><FaUsers className="inline mr-1" />{data.qtdPessoas || 0} pessoa(s)</span>
        {data.realizadoQtd != null && data.orcadoQtd != null ? (
          <span className="font-semibold">{data.realizadoQtd}/{data.orcadoQtd}</span>
        ) : null}
      </div>
      <Handle type="source" position={Position.Bottom} className="!h-2 !w-2 !bg-slate-400" />
    </div>
  );
}

const nodeTypes = { area: AreaNode };

// Auto layout simples: BFS por niveis quando uma area nao tem canvas_x salvo
function autoLayout(areas) {
  const byCodigo = new Map(areas.map((a) => [a.codigo, a]));
  const children = new Map();
  for (const a of areas) {
    const p = a.parent_codigo || null;
    if (!children.has(p)) children.set(p, []);
    children.get(p).push(a);
  }
  for (const [, list] of children) list.sort((x, y) => (x.ordem || 0) - (y.ordem || 0));

  const positions = new Map();
  const widthPerLeaf = 260;
  const heightPerLevel = 170;

  function countLeaves(codigo) {
    const kids = children.get(codigo) || [];
    if (!kids.length) return 1;
    return kids.reduce((acc, k) => acc + countLeaves(k.codigo), 0);
  }

  function place(codigo, level, leftLeafOffset) {
    const kids = children.get(codigo) || [];
    if (!kids.length) {
      positions.set(codigo, { x: leftLeafOffset * widthPerLeaf, y: level * heightPerLevel });
      return 1;
    }
    let consumed = 0;
    const childRanges = [];
    for (const k of kids) {
      const w = place(k.codigo, level + 1, leftLeafOffset + consumed);
      childRanges.push({ codigo: k.codigo, start: leftLeafOffset + consumed, width: w });
      consumed += w;
    }
    const start = childRanges[0].start;
    const end = childRanges[childRanges.length - 1].start + childRanges[childRanges.length - 1].width - 1;
    const center = (start + end) / 2;
    positions.set(codigo, { x: center * widthPerLeaf, y: level * heightPerLevel });
    return consumed;
  }

  const roots = (children.get(null) || []);
  let offset = 0;
  for (const r of roots) {
    const w = countLeaves(r.codigo);
    place(r.codigo, 0, offset);
    offset += w;
  }

  return positions;
}

export default function OrganogramaCanvas() {
  const [areas, setAreas] = useState([]);
  const [pessoas, setPessoas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const dirtyRef = useRef(new Map());

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

  // Monta nodes/edges quando os dados chegam
  useEffect(() => {
    if (!areas.length) {
      setNodes([]);
      setEdges([]);
      return;
    }
    const pessoasPorArea = new Map();
    for (const p of pessoas) {
      const k = p.area_codigo;
      pessoasPorArea.set(k, (pessoasPorArea.get(k) || 0) + 1);
    }
    const auto = autoLayout(areas);
    const newNodes = areas.map((a) => {
      const auto1 = auto.get(a.codigo) || { x: 0, y: 0 };
      const x = a.canvas_x != null ? Number(a.canvas_x) : auto1.x;
      const y = a.canvas_y != null ? Number(a.canvas_y) : auto1.y;
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
          orcadoQtd: a.orcado_qtd,
          realizadoQtd: a.realizado_qtd,
          qtdPessoas: pessoasPorArea.get(a.codigo) || 0,
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
  }, [areas, pessoas, setEdges, setNodes]);

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
        updates.push(
          supabase
            .from("organograma_manutencao_areas")
            .update({ canvas_x: pos.x, canvas_y: pos.y })
            .eq("codigo", codigo)
        );
      }
      const results = await Promise.all(updates);
      const firstError = results.find((r) => r.error);
      if (firstError?.error) throw firstError.error;
      dirtyRef.current.clear();
      setStatusMsg("Layout salvo no Supabase.");
    } catch (error) {
      console.error(error);
      alert(error?.message || "Nao foi possivel salvar o layout.");
    } finally {
      setSaving(false);
    }
  }

  const stats = useMemo(() => ({
    areas: areas.length,
    pessoas: pessoas.length,
  }), [areas, pessoas]);

  return (
    <div className="flex h-[calc(100vh-90px)] flex-col gap-3 p-3 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-blue-600">Pessoas · Organograma</div>
          <h1 className="text-2xl font-black text-slate-900 md:text-3xl">Organograma · Canvas</h1>
          <p className="text-sm text-slate-500">
            Tela infinita estilo Miro. Arraste as caixas, conecte com setas e salve o layout no banco.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm">
            {stats.areas} area(s) · {stats.pessoas} pessoa(s)
          </div>
          <button
            type="button"
            onClick={carregar}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60"
          >
            <FaSync /> Recarregar
          </button>
          <button
            type="button"
            onClick={salvarPosicoes}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow hover:bg-blue-700 disabled:opacity-60"
          >
            <FaSave /> {saving ? "Salvando..." : "Salvar layout"}
          </button>
        </div>
      </div>

      {statusMsg ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
          {statusMsg}
        </div>
      ) : null}

      <div className="flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-sm">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={handleNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.2}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={20} size={1} color="#cbd5e1" />
          <Controls position="bottom-right" showInteractive={false} />
          <MiniMap pannable zoomable nodeColor={(n) => {
            const c = pickCor(n.data?.cor);
            // approximate hex from tailwind
            const map = { emerald: "#10b981", blue: "#3b82f6", amber: "#f59e0b", sky: "#0ea5e9", orange: "#f97316", stone: "#94a3b8" };
            return map[n.data?.cor] || "#94a3b8";
          }} />
        </ReactFlow>
      </div>
    </div>
  );
}
