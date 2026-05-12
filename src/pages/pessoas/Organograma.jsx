import { useEffect, useMemo, useState } from "react";
import {
  FaClipboardList,
  FaEdit,
  FaLayerGroup,
  FaPlus,
  FaSearch,
  FaSitemap,
  FaSync,
  FaTimes,
  FaTrash,
  FaUsers,
} from "react-icons/fa";
import { supabase } from "../../supabase";
import {
  ORGANOGRAMA_FALLBACK_AREAS,
  ORGANOGRAMA_FALLBACK_PESSOAS,
} from "./organogramaModel";

const PAGINAS = [
  { value: "MANUTENCAO", label: "Manutenção", tone: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  { value: "OPERACAO", label: "Operação", tone: "border-sky-200 bg-sky-50 text-sky-700" },
  { value: "ADM", label: "Adm", tone: "border-violet-200 bg-violet-50 text-violet-700" },
];

const TIPOS = [
  { value: "GESTAO", label: "Liderança" },
  { value: "SQUAD", label: "Equipe" },
  { value: "CELULA", label: "Célula" },
];

const TURNOS = [
  { value: "DIURNA", label: "Diurna" },
  { value: "NOTURNA", label: "Noturna" },
  { value: "GERAL", label: "Geral" },
];

const CORES = [
  { value: "stone", label: "Neutro" },
  { value: "emerald", label: "Verde" },
  { value: "blue", label: "Azul" },
  { value: "amber", label: "Amarelo" },
  { value: "sky", label: "Céu" },
  { value: "orange", label: "Laranja" },
];

function normalizeText(value = "") {
  return String(value || "").trim().toLowerCase();
}

function fmtInt(value) {
  return Math.round(Number(value || 0)).toLocaleString("pt-BR");
}

function slugify(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
}

function buildAreaTone(color = "stone") {
  const tones = {
    stone: {
      card: "border-stone-300 bg-stone-50 text-stone-800",
      badge: "bg-stone-100 text-stone-700 border-stone-200",
    },
    emerald: {
      card: "border-emerald-300 bg-emerald-50 text-emerald-900",
      badge: "bg-emerald-100 text-emerald-700 border-emerald-200",
    },
    blue: {
      card: "border-blue-300 bg-blue-50 text-blue-900",
      badge: "bg-blue-100 text-blue-700 border-blue-200",
    },
    amber: {
      card: "border-amber-300 bg-amber-50 text-amber-900",
      badge: "bg-amber-100 text-amber-700 border-amber-200",
    },
    sky: {
      card: "border-sky-300 bg-sky-50 text-sky-900",
      badge: "bg-sky-100 text-sky-700 border-sky-200",
    },
    orange: {
      card: "border-orange-300 bg-orange-50 text-orange-900",
      badge: "bg-orange-100 text-orange-700 border-orange-200",
    },
  };

  return tones[color] || tones.stone;
}

function buildPaginaBadgeClasses(value) {
  return PAGINAS.find((item) => item.value === value)?.tone || PAGINAS[0].tone;
}

function normalizeArea(row) {
  return {
    id: row?.id ?? null,
    codigo: String(row?.codigo || "").trim(),
    parentCodigo: row?.parent_codigo ?? row?.parentCodigo ?? null,
    titulo: String(row?.titulo || "").trim(),
    subtitulo: String(row?.subtitulo || "").trim(),
    tipo: String(row?.tipo || "CELULA").trim().toUpperCase(),
    grupo: String(row?.grupo || "").trim(),
    turno: String(row?.turno || "GERAL").trim().toUpperCase(),
    cor: String(row?.cor || "stone").trim().toLowerCase(),
    ordem: Number(row?.ordem || 0),
    detalhe: String(row?.detalhe || "").trim(),
    ativo: row?.ativo !== false,
    paginaOrganograma: String(
      row?.pagina_organograma ?? row?.paginaOrganograma ?? "MANUTENCAO"
    )
      .trim()
      .toUpperCase(),
    orcadoPlanejado:
      row?.orcado_planejado === null || row?.orcado_planejado === undefined || row?.orcado_planejado === ""
        ? null
        : Number(row.orcado_planejado),
  };
}

function normalizePessoa(row) {
  return {
    id: row?.id ?? null,
    areaCodigo: String(row?.area_codigo ?? row?.areaCodigo ?? "").trim(),
    nome: String(row?.nome || "").trim(),
    cargo: String(row?.cargo || "").trim(),
    tipoHeadcount: String(row?.tipo_headcount ?? row?.tipoHeadcount ?? "REALIZADO")
      .trim()
      .toUpperCase(),
    turno: String(row?.turno || "GERAL").trim().toUpperCase(),
    status: String(row?.status || "ATIVO").trim().toUpperCase(),
    ordem: Number(row?.ordem || 0),
    chapa: String(row?.chapa || "").trim(),
    telefone: String(row?.telefone || "").trim(),
    observacao: String(row?.observacao || "").trim(),
    ativo: row?.ativo !== false,
  };
}

function sortAreas(rows = []) {
  return [...rows].sort(
    (a, b) => a.ordem - b.ordem || a.titulo.localeCompare(b.titulo, "pt-BR")
  );
}

function buildChildrenMap(areas) {
  const map = new Map();

  areas.forEach((area) => {
    const key = area.parentCodigo || "__ROOT__";
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(area);
  });

  for (const entries of map.values()) {
    entries.sort((a, b) => a.ordem - b.ordem || a.titulo.localeCompare(b.titulo, "pt-BR"));
  }

  return map;
}

function collectDescendantCodes(areaCode, childrenMap) {
  const result = new Set([areaCode]);
  const stack = [areaCode];

  while (stack.length) {
    const current = stack.pop();
    const children = childrenMap.get(current) || [];

    children.forEach((child) => {
      if (!result.has(child.codigo)) {
        result.add(child.codigo);
        stack.push(child.codigo);
      }
    });
  }

  return result;
}

function buildMetricsMap(areas, pessoas, childrenMap) {
  const directMap = new Map(
    areas.map((area) => [
      area.codigo,
      {
        orcado: Number.isFinite(area.orcadoPlanejado) ? Number(area.orcadoPlanejado) : null,
        realizado: 0,
      },
    ])
  );

  pessoas.forEach((pessoa) => {
    if (!pessoa.ativo || !directMap.has(pessoa.areaCodigo)) return;
    const entry = directMap.get(pessoa.areaCodigo);
    if (pessoa.tipoHeadcount === "REALIZADO") entry.realizado += 1;
    if (pessoa.tipoHeadcount === "ORCADO" && !Number.isFinite(entry.orcado)) {
      entry.orcado = Number(entry.orcado || 0) + 1;
    }
  });

  const cache = new Map();

  function aggregate(areaCode) {
    if (cache.has(areaCode)) return cache.get(areaCode);

    const base = directMap.get(areaCode) || { orcado: 0, realizado: 0 };
    const totals = {
      orcado: Number(base.orcado || 0),
      realizado: Number(base.realizado || 0),
    };
    const children = childrenMap.get(areaCode) || [];

    children.forEach((child) => {
      const childTotals = aggregate(child.codigo);
      totals.orcado += childTotals.orcado;
      totals.realizado += childTotals.realizado;
    });

    cache.set(areaCode, totals);
    return totals;
  }

  areas.forEach((area) => aggregate(area.codigo));
  return cache;
}

function getNextOrdem(rows = []) {
  return rows.length ? Math.max(...rows.map((row) => Number(row?.ordem || 0))) + 10 : 10;
}

function AreaEditorModal({
  mode,
  draft,
  parentOptions,
  onChange,
  onClose,
  onSave,
}) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-3xl overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b bg-slate-50 px-5 py-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-blue-700">
              <FaSitemap /> {mode === "create" ? "Nova caixa" : "Editar caixa"}
            </div>
            <h2 className="mt-3 text-xl font-black text-slate-800">
              {mode === "create" ? "Construir estrutura do zero" : "Atualizar caixa do organograma"}
            </h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              Organize a área, escolha a página e deixe a estrutura pronta no estilo do Miro.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
          >
            <FaTimes />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2">
          <Field label="Título">
            <input
              value={draft.titulo}
              onChange={(event) => onChange("titulo", event.target.value)}
              className="w-full rounded-2xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-800 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
              placeholder="Ex.: Equipe Corretiva"
            />
          </Field>

          <Field label="Subtítulo">
            <input
              value={draft.subtitulo}
              onChange={(event) => onChange("subtitulo", event.target.value)}
              className="w-full rounded-2xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-800 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
              placeholder="Ex.: Atendimento diurno"
            />
          </Field>

          <Field label="Página">
            <select
              value={draft.paginaOrganograma}
              onChange={(event) => onChange("paginaOrganograma", event.target.value)}
              className="w-full rounded-2xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-800 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
            >
              {PAGINAS.map((pagina) => (
                <option key={pagina.value} value={pagina.value}>
                  {pagina.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Caixa pai">
            <select
              value={draft.parentCodigo || ""}
              onChange={(event) => onChange("parentCodigo", event.target.value || null)}
              className="w-full rounded-2xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-800 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
            >
              <option value="">Sem pai (topo da página)</option>
              {parentOptions.map((area) => (
                <option key={area.codigo} value={area.codigo}>
                  {area.titulo}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Tipo">
            <select
              value={draft.tipo}
              onChange={(event) => onChange("tipo", event.target.value)}
              className="w-full rounded-2xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-800 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
            >
              {TIPOS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Turno">
            <select
              value={draft.turno}
              onChange={(event) => onChange("turno", event.target.value)}
              className="w-full rounded-2xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-800 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
            >
              {TURNOS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Cor">
            <select
              value={draft.cor}
              onChange={(event) => onChange("cor", event.target.value)}
              className="w-full rounded-2xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-800 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
            >
              {CORES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Orçado">
            <input
              type="number"
              min="0"
              step="1"
              value={draft.orcadoPlanejado}
              onChange={(event) => onChange("orcadoPlanejado", event.target.value)}
              className="w-full rounded-2xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-800 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
              placeholder="0"
            />
          </Field>

          <Field label="Grupo" spanFull>
            <input
              value={draft.grupo}
              onChange={(event) => onChange("grupo", event.target.value)}
              className="w-full rounded-2xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-800 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
              placeholder="Ex.: Equipe Corretiva"
            />
          </Field>

          <Field label="Detalhe" spanFull>
            <textarea
              rows={3}
              value={draft.detalhe}
              onChange={(event) => onChange("detalhe", event.target.value)}
              className="w-full rounded-2xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-800 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
              placeholder="Texto de apoio para a caixa"
            />
          </Field>
        </div>

        <div className="flex justify-end gap-2 border-t bg-white px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 hover:border-slate-400"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onSave}
            className="rounded-2xl bg-slate-900 px-5 py-2.5 text-sm font-black text-white hover:bg-slate-800"
          >
            Salvar caixa
          </button>
        </div>
      </div>
    </div>
  );
}

function PessoaEditorModal({ draft, areaOptions, onChange, onClose, onSave }) {
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-3xl overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b bg-slate-50 px-5 py-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-blue-700">
              <FaUsers /> Registro de pessoa
            </div>
            <h2 className="mt-3 text-xl font-black text-slate-800">
              {draft.id ? "Editar pessoa/vaga" : "Adicionar pessoa/vaga"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
          >
            <FaTimes />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2">
          <Field label="Nome">
            <input
              value={draft.nome}
              onChange={(event) => onChange("nome", event.target.value)}
              className="w-full rounded-2xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-800 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
              placeholder="Nome da pessoa ou vaga"
            />
          </Field>

          <Field label="Cargo">
            <input
              value={draft.cargo}
              onChange={(event) => onChange("cargo", event.target.value)}
              className="w-full rounded-2xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-800 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
              placeholder="Cargo"
            />
          </Field>

          <Field label="Área">
            <select
              value={draft.areaCodigo}
              onChange={(event) => onChange("areaCodigo", event.target.value)}
              className="w-full rounded-2xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-800 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
            >
              {areaOptions.map((area) => (
                <option key={area.codigo} value={area.codigo}>
                  {area.titulo}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Tipo">
            <select
              value={draft.tipoHeadcount}
              onChange={(event) => onChange("tipoHeadcount", event.target.value)}
              className="w-full rounded-2xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-800 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
            >
              <option value="REALIZADO">Realizado</option>
              <option value="ORCADO">Orçado</option>
            </select>
          </Field>

          <Field label="Turno">
            <select
              value={draft.turno}
              onChange={(event) => onChange("turno", event.target.value)}
              className="w-full rounded-2xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-800 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
            >
              {TURNOS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Status">
            <input
              value={draft.status}
              onChange={(event) => onChange("status", event.target.value)}
              className="w-full rounded-2xl border border-slate-300 px-4 py-2.5 text-sm font-bold uppercase text-slate-800 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
              placeholder="ATIVO"
            />
          </Field>

          <Field label="Chapa">
            <input
              value={draft.chapa}
              onChange={(event) => onChange("chapa", event.target.value)}
              className="w-full rounded-2xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-800 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
              placeholder="Opcional"
            />
          </Field>

          <Field label="Telefone">
            <input
              value={draft.telefone}
              onChange={(event) => onChange("telefone", event.target.value)}
              className="w-full rounded-2xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-800 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
              placeholder="Opcional"
            />
          </Field>

          <Field label="Observação" spanFull>
            <textarea
              rows={3}
              value={draft.observacao}
              onChange={(event) => onChange("observacao", event.target.value)}
              className="w-full rounded-2xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-800 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
              placeholder="Observação"
            />
          </Field>
        </div>

        <div className="flex justify-end gap-2 border-t bg-white px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 hover:border-slate-400"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onSave}
            className="rounded-2xl bg-slate-900 px-5 py-2.5 text-sm font-black text-white hover:bg-slate-800"
          >
            Salvar registro
          </button>
        </div>
      </div>
    </div>
  );
}

function PessoasModal({
  area,
  areasByCode,
  childrenMap,
  metricsMap,
  pessoas,
  onClose,
  onSaveArea,
  onSavePessoa,
  onDeletePessoa,
}) {
  const [busca, setBusca] = useState("");
  const [tipoFiltro, setTipoFiltro] = useState("");
  const [draftOrcado, setDraftOrcado] = useState(
    area.orcadoPlanejado === null || area.orcadoPlanejado === undefined ? "" : String(area.orcadoPlanejado)
  );
  const [pessoaDraft, setPessoaDraft] = useState(null);

  useEffect(() => {
    setDraftOrcado(
      area.orcadoPlanejado === null || area.orcadoPlanejado === undefined
        ? ""
        : String(area.orcadoPlanejado)
    );
  }, [area]);

  const descendantCodes = useMemo(
    () => collectDescendantCodes(area.codigo, childrenMap),
    [area.codigo, childrenMap]
  );

  const areaOptions = useMemo(
    () =>
      Array.from(descendantCodes)
        .map((codigo) => areasByCode.get(codigo))
        .filter(Boolean)
        .sort((a, b) => a.ordem - b.ordem || a.titulo.localeCompare(b.titulo, "pt-BR")),
    [areasByCode, descendantCodes]
  );

  const registros = useMemo(() => {
    const term = normalizeText(busca);

    return pessoas
      .filter((pessoa) => descendantCodes.has(pessoa.areaCodigo))
      .filter((pessoa) => {
        if (tipoFiltro && pessoa.tipoHeadcount !== tipoFiltro) return false;
        if (!term) return true;
        return normalizeText(
          `${pessoa.nome} ${pessoa.cargo} ${pessoa.status} ${pessoa.areaCodigo}`
        ).includes(term);
      })
      .sort((a, b) => {
        const areaA = areasByCode.get(a.areaCodigo)?.ordem || 0;
        const areaB = areasByCode.get(b.areaCodigo)?.ordem || 0;
        return areaA - areaB || a.ordem - b.ordem || a.nome.localeCompare(b.nome, "pt-BR");
      });
  }, [areasByCode, busca, descendantCodes, pessoas, tipoFiltro]);

  const metrics = metricsMap.get(area.codigo) || { orcado: 0, realizado: 0 };

  function openNewPessoa() {
    setPessoaDraft({
      id: null,
      areaCodigo: area.codigo,
      nome: "",
      cargo: "",
      tipoHeadcount: "REALIZADO",
      turno: area.turno || "GERAL",
      status: "ATIVO",
      chapa: "",
      telefone: "",
      observacao: "",
    });
  }

  function openEditPessoa(pessoa) {
    setPessoaDraft({ ...pessoa });
  }

  async function handleSavePessoa() {
    if (!pessoaDraft?.nome?.trim()) {
      alert("Informe o nome da pessoa ou vaga.");
      return;
    }

    await onSavePessoa(pessoaDraft);
    setPessoaDraft(null);
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-7xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b bg-slate-50 px-5 py-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-blue-700">
              <FaUsers /> Modal de Pessoas
            </div>
            <h2 className="mt-3 text-xl font-black text-slate-800">{area.titulo}</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              {area.subtitulo || area.detalhe || "Gerencie orçado, realizado e registros da equipe."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
          >
            <FaTimes />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 border-b bg-white px-5 py-4 md:grid-cols-4">
          <KpiCard title="Orçado" value={fmtInt(metrics.orcado)} sub="Planejado da estrutura" tone="blue" />
          <KpiCard title="Realizado" value={fmtInt(metrics.realizado)} sub="Pessoas ativas na estrutura" tone="emerald" />
          <KpiCard title="Delta" value={fmtInt(metrics.realizado - metrics.orcado)} sub="Realizado menos orçado" tone="amber" />
          <KpiCard title="Caixas cobertas" value={fmtInt(descendantCodes.size)} sub="Hierarquia ligada a esta caixa" tone="slate" />
        </div>

        <div className="grid grid-cols-1 gap-4 border-b bg-slate-50 px-5 py-4 xl:grid-cols-[0.8fr_1.4fr]">
          <div>
            <label className="mb-2 block text-[10px] font-black uppercase tracking-wider text-slate-500">
              Orçado da caixa
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                min="0"
                step="1"
                value={draftOrcado}
                onChange={(event) => setDraftOrcado(event.target.value)}
                className="w-full rounded-2xl border border-slate-300 px-4 py-2.5 text-sm font-black text-slate-800 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                placeholder="0"
              />
              <button
                type="button"
                onClick={() =>
                  onSaveArea(area.codigo, {
                    orcadoPlanejado: draftOrcado === "" ? null : Math.max(0, Number(draftOrcado)),
                  })
                }
                className="rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-black text-white hover:bg-slate-800"
              >
                Salvar
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div className="w-full md:max-w-xl">
              <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-500">
                Buscar pessoa ou vaga
              </label>
              <div className="relative">
                <FaSearch className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={busca}
                  onChange={(event) => setBusca(event.target.value)}
                  placeholder="Nome, cargo, área ou status..."
                  className="w-full rounded-2xl border border-slate-300 bg-white py-2.5 pl-11 pr-4 text-sm font-bold text-slate-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <select
                value={tipoFiltro}
                onChange={(event) => setTipoFiltro(event.target.value)}
                className="rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
              >
                <option value="">Todos</option>
                <option value="REALIZADO">Realizado</option>
                <option value="ORCADO">Orçado</option>
              </select>
              <button
                type="button"
                onClick={openNewPessoa}
                className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-black text-white hover:bg-blue-500"
              >
                <FaPlus /> Adicionar pessoa
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto px-5 py-4">
          <div className="overflow-x-auto">
            <table className="min-w-[1100px] w-full text-left text-sm">
              <thead className="border-b bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="p-3">Pessoa / Vaga</th>
                  <th className="p-3">Cargo</th>
                  <th className="p-3">Área</th>
                  <th className="p-3">Turno</th>
                  <th className="p-3">Tipo</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {registros.map((pessoa) => {
                  const areaPessoa = areasByCode.get(pessoa.areaCodigo);
                  const isOrcado = pessoa.tipoHeadcount === "ORCADO";

                  return (
                    <tr key={`${pessoa.id}-${pessoa.nome}-${pessoa.areaCodigo}`} className="hover:bg-slate-50">
                      <td className="p-3">
                        <p className="font-black text-slate-800">{pessoa.nome || "-"}</p>
                        {pessoa.chapa ? (
                          <p className="mt-1 text-xs font-semibold text-slate-400">Chapa {pessoa.chapa}</p>
                        ) : null}
                      </td>
                      <td className="p-3 font-semibold text-slate-700">{pessoa.cargo || "-"}</td>
                      <td className="p-3 font-semibold text-slate-700">{areaPessoa?.titulo || pessoa.areaCodigo}</td>
                      <td className="p-3 font-semibold text-slate-600">{pessoa.turno || "-"}</td>
                      <td className="p-3">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-black ${
                            isOrcado
                              ? "border-blue-200 bg-blue-50 text-blue-700"
                              : "border-emerald-200 bg-emerald-50 text-emerald-700"
                          }`}
                        >
                          {isOrcado ? "Orçado" : "Realizado"}
                        </span>
                      </td>
                      <td className="p-3 font-semibold text-slate-700">{pessoa.status || "-"}</td>
                      <td className="p-3">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openEditPessoa(pessoa)}
                            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-700 hover:border-slate-400"
                          >
                            <FaEdit className="inline mr-1" /> Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeletePessoa(pessoa)}
                            className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-black text-rose-700 hover:bg-rose-100"
                          >
                            <FaTrash className="inline mr-1" /> Excluir
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {registros.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-sm font-bold text-slate-400">
                      Nenhum registro encontrado. Você pode começar do zero adicionando a primeira pessoa ou vaga.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex justify-end border-t bg-white px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl bg-slate-900 px-5 py-2.5 text-sm font-black text-white hover:bg-slate-800"
          >
            Fechar
          </button>
        </div>
      </div>

      {pessoaDraft ? (
        <PessoaEditorModal
          draft={pessoaDraft}
          areaOptions={areaOptions}
          onClose={() => setPessoaDraft(null)}
          onChange={(field, value) =>
            setPessoaDraft((current) => ({
              ...current,
              [field]: value,
            }))
          }
          onSave={handleSavePessoa}
        />
      ) : null}
    </div>
  );
}

function Field({ label, children, spanFull = false }) {
  return (
    <div className={spanFull ? "md:col-span-2" : ""}>
      <label className="mb-2 block text-[10px] font-black uppercase tracking-wider text-slate-500">
        {label}
      </label>
      {children}
    </div>
  );
}

function KpiCard({ title, value, sub, tone = "slate" }) {
  const tones = {
    slate: "from-slate-50 to-white border-slate-200 text-slate-700",
    emerald: "from-emerald-50 to-teal-50 border-emerald-200 text-emerald-700",
    blue: "from-blue-50 to-cyan-50 border-blue-200 text-blue-700",
    amber: "from-amber-50 to-yellow-50 border-amber-200 text-amber-700",
  };

  return (
    <div className={`rounded-2xl border bg-gradient-to-br ${tones[tone]} p-4 shadow-sm`}>
      <p className="text-[11px] font-black uppercase tracking-wider opacity-80">{title}</p>
      <p className="mt-2 text-2xl font-black text-slate-800">{value}</p>
      {sub ? <p className="mt-1 text-xs font-bold opacity-80">{sub}</p> : null}
    </div>
  );
}

function AreaCard({ area, metrics, onOpenPeople, onEdit, onAddChild, onDelete }) {
  const tone = buildAreaTone(area.cor);

  return (
    <div className={`w-64 rounded-2xl border px-4 py-3 shadow-sm ${tone.card}`}>
      <div className="flex items-start justify-between gap-2">
        <span className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-wider ${tone.badge}`}>
          {TIPOS.find((item) => item.value === area.tipo)?.label || area.tipo}
        </span>
        <div className="flex flex-col items-end gap-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
            {TURNOS.find((item) => item.value === area.turno)?.label || area.turno}
          </span>
          <span className={`inline-flex rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${buildPaginaBadgeClasses(area.paginaOrganograma)}`}>
            {PAGINAS.find((item) => item.value === area.paginaOrganograma)?.label || "Manutenção"}
          </span>
        </div>
      </div>

      <h3 className="mt-3 text-sm font-black leading-tight text-slate-900">{area.titulo}</h3>
      <p className="mt-1 text-[11px] font-semibold text-slate-600">{area.subtitulo || area.detalhe || "-"}</p>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-white/60 bg-white/70 px-3 py-2">
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Orçado</p>
          <p className="mt-1 text-base font-black text-slate-800">{fmtInt(metrics.orcado)}</p>
        </div>
        <div className="rounded-xl border border-white/60 bg-white/70 px-3 py-2">
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Realizado</p>
          <p className="mt-1 text-base font-black text-slate-800">{fmtInt(metrics.realizado)}</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onOpenPeople(area)}
          className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-black text-white hover:bg-slate-800"
        >
          <FaUsers className="inline mr-1" /> Pessoas
        </button>
        <button
          type="button"
          onClick={() => onAddChild(area)}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 hover:border-slate-400"
        >
          <FaPlus className="inline mr-1" /> Filho
        </button>
        <button
          type="button"
          onClick={() => onEdit(area)}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 hover:border-slate-400"
        >
          <FaEdit className="inline mr-1" /> Editar
        </button>
        <button
          type="button"
          onClick={() => onDelete(area)}
          className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-black text-rose-700 hover:bg-rose-100"
        >
          <FaTrash className="inline mr-1" /> Excluir
        </button>
      </div>
    </div>
  );
}

function TreeNode({ area, childrenMap, metricsMap, onOpenPeople, onEdit, onAddChild, onDelete, isRoot = false }) {
  const children = childrenMap.get(area.codigo) || [];

  return (
    <li className="relative flex flex-col items-center px-3">
      {!isRoot ? (
        <span className="absolute left-1/2 top-0 h-6 -translate-x-1/2 border-l border-slate-300" />
      ) : null}

      <AreaCard
        area={area}
        metrics={metricsMap.get(area.codigo) || { orcado: 0, realizado: 0 }}
        onOpenPeople={onOpenPeople}
        onEdit={onEdit}
        onAddChild={onAddChild}
        onDelete={onDelete}
      />

      {children.length ? (
        <div className="relative mt-6 flex justify-center">
          <span className="absolute left-1/2 top-0 h-6 -translate-x-1/2 border-l border-slate-300" />
          {children.length > 1 ? (
            <span className="absolute left-10 right-10 top-0 border-t border-slate-300" />
          ) : null}
          <ul className="flex items-start justify-center gap-3 pt-6">
            {children.map((child) => (
              <TreeNode
                key={child.codigo}
                area={child}
                childrenMap={childrenMap}
                metricsMap={metricsMap}
                onOpenPeople={onOpenPeople}
                onEdit={onEdit}
                onAddChild={onAddChild}
                onDelete={onDelete}
              />
            ))}
          </ul>
        </div>
      ) : null}
    </li>
  );
}

function buildEmptyAreaDraft(activePage, parentArea, pageAreas) {
  return {
    id: null,
    codigo: "",
    parentCodigo: parentArea?.codigo || null,
    titulo: "",
    subtitulo: "",
    tipo: parentArea ? "CELULA" : "GESTAO",
    grupo: parentArea?.grupo || "",
    turno: parentArea?.turno || "DIURNA",
    cor: parentArea?.cor || "emerald",
    ordem: getNextOrdem(pageAreas),
    detalhe: "",
    paginaOrganograma: parentArea?.paginaOrganograma || activePage,
    orcadoPlanejado: "",
  };
}

export default function Organograma() {
  const [areas, setAreas] = useState([]);
  const [pessoas, setPessoas] = useState([]);
  const [activePage, setActivePage] = useState("MANUTENCAO");
  const [loading, setLoading] = useState(false);
  const [fonte, setFonte] = useState("SUPABASE");
  const [feedback, setFeedback] = useState(null);
  const [selecionada, setSelecionada] = useState(null);
  const [editorState, setEditorState] = useState(null);
  const [zoom, setZoom] = useState(1);

  async function carregarBase() {
    setLoading(true);
    setFeedback(null);

    try {
      const [areasResp, pessoasResp] = await Promise.all([
        supabase.from("organograma_manutencao_areas").select("*").eq("ativo", true),
        supabase.from("organograma_manutencao_pessoas").select("*").eq("ativo", true),
      ]);

      if (areasResp.error) throw areasResp.error;
      if (pessoasResp.error) throw pessoasResp.error;

      const areasDb = sortAreas((areasResp.data || []).map(normalizeArea).filter((item) => item.codigo));
      const pessoasDb = (pessoasResp.data || []).map(normalizePessoa).filter((item) => item.areaCodigo);

      setAreas(areasDb);
      setPessoas(pessoasDb);
      setFonte("SUPABASE");

      if (!areasDb.length) {
        setFeedback({
          type: "info",
          text: "A estrutura está vazia. Você pode começar do zero escolhendo uma das três páginas e criando a primeira caixa.",
        });
      }
    } catch (error) {
      console.error("Falha ao carregar organograma:", error);
      setFeedback({
        type: "error",
        text: "Não foi possível consultar o Supabase agora. Ajuste a migration e tente atualizar novamente.",
      });
      setAreas([]);
      setPessoas([]);
      setFonte("ERRO");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void carregarBase();
  }, []);

  const areasAtivas = useMemo(() => areas.filter((area) => area.ativo !== false), [areas]);
  const pessoasAtivas = useMemo(() => pessoas.filter((pessoa) => pessoa.ativo !== false), [pessoas]);
  const allChildrenMap = useMemo(() => buildChildrenMap(areasAtivas), [areasAtivas]);
  const areasByCode = useMemo(
    () => new Map(areasAtivas.map((area) => [area.codigo, area])),
    [areasAtivas]
  );

  const pageAreas = useMemo(
    () => sortAreas(areasAtivas.filter((area) => area.paginaOrganograma === activePage)),
    [activePage, areasAtivas]
  );
  const pageChildrenMap = useMemo(() => buildChildrenMap(pageAreas), [pageAreas]);
  const pageMetricsMap = useMemo(
    () => buildMetricsMap(pageAreas, pessoasAtivas, pageChildrenMap),
    [pageAreas, pessoasAtivas, pageChildrenMap]
  );
  const roots = useMemo(() => pageChildrenMap.get("__ROOT__") || [], [pageChildrenMap]);

  const totalAreas = areasAtivas.length;
  const totalPessoas = pessoasAtivas.filter((pessoa) => pessoa.tipoHeadcount === "REALIZADO").length;
  const totalOrcado = useMemo(() => {
    const allMetrics = buildMetricsMap(areasAtivas, pessoasAtivas, allChildrenMap);
    const allRoots = allChildrenMap.get("__ROOT__") || [];
    return allRoots.reduce((acc, area) => acc + (allMetrics.get(area.codigo)?.orcado || 0), 0);
  }, [allChildrenMap, areasAtivas, pessoasAtivas]);

  const pageStats = useMemo(() => {
    const pagePeople = pessoasAtivas.filter((pessoa) => {
      const area = areasByCode.get(pessoa.areaCodigo);
      return area?.paginaOrganograma === activePage;
    });
    const rootTotals = roots.reduce(
      (acc, area) => {
        const current = pageMetricsMap.get(area.codigo) || { orcado: 0, realizado: 0 };
        return {
          orcado: acc.orcado + current.orcado,
          realizado: acc.realizado + current.realizado,
        };
      },
      { orcado: 0, realizado: 0 }
    );

    return {
      caixas: pageAreas.length,
      pessoas: pagePeople.filter((pessoa) => pessoa.tipoHeadcount === "REALIZADO").length,
      orcado: rootTotals.orcado,
      realizado: rootTotals.realizado,
    };
  }, [activePage, areasByCode, pageAreas, pageMetricsMap, pessoasAtivas, roots]);

  function openCreateRoot() {
    setEditorState({
      mode: "create",
      draft: buildEmptyAreaDraft(activePage, null, pageAreas),
    });
  }

  function openCreateChild(parentArea) {
    setEditorState({
      mode: "create",
      draft: buildEmptyAreaDraft(activePage, parentArea, pageAreas),
    });
  }

  function openEditArea(area) {
    setEditorState({
      mode: "edit",
      draft: {
        ...area,
        orcadoPlanejado:
          area.orcadoPlanejado === null || area.orcadoPlanejado === undefined
            ? ""
            : String(area.orcadoPlanejado),
      },
    });
  }

  function handleEditorChange(field, value) {
    setEditorState((current) => ({
      ...current,
      draft: {
        ...current.draft,
        [field]: value,
      },
    }));
  }

  async function handleSaveAreaDraft() {
    const draft = editorState?.draft;
    if (!draft?.titulo?.trim()) {
      alert("Informe o título da caixa.");
      return;
    }

    const pageParentOptions = pageAreas.filter(
      (area) => area.codigo !== draft.codigo && area.paginaOrganograma === draft.paginaOrganograma
    );

    if (
      draft.parentCodigo &&
      !pageParentOptions.some((area) => area.codigo === draft.parentCodigo)
    ) {
      alert("Escolha um pai da mesma página.");
      return;
    }

    const payload = {
      codigo:
        draft.codigo ||
        `${slugify(draft.titulo)}_${Date.now().toString().slice(-6)}`,
      parent_codigo: draft.parentCodigo || null,
      titulo: draft.titulo.trim(),
      subtitulo: draft.subtitulo.trim(),
      tipo: draft.tipo,
      grupo: draft.grupo.trim() || draft.titulo.trim(),
      turno: draft.turno,
      cor: draft.cor,
      ordem: Number(draft.ordem || getNextOrdem(pageAreas)),
      detalhe: draft.detalhe.trim(),
      ativo: true,
      pagina_organograma: draft.paginaOrganograma,
      orcado_planejado:
        draft.orcadoPlanejado === "" || draft.orcadoPlanejado === null || draft.orcadoPlanejado === undefined
          ? null
          : Math.max(0, Number(draft.orcadoPlanejado)),
    };

    const query = draft.id
      ? supabase.from("organograma_manutencao_areas").update(payload).eq("id", draft.id)
      : supabase.from("organograma_manutencao_areas").insert(payload);

    const { error } = await query;
    if (error) {
      console.error(error);
      alert("Não foi possível salvar a caixa do organograma.");
      return;
    }

    setEditorState(null);
    await carregarBase();
  }

  async function handleSaveAreaPatch(areaCodigo, partial) {
    const area = areasByCode.get(areaCodigo);
    if (!area) return;

    const payload = {};
    if (partial.orcadoPlanejado !== undefined) {
      payload.orcado_planejado =
        partial.orcadoPlanejado === "" || partial.orcadoPlanejado === null
          ? null
          : Math.max(0, Number(partial.orcadoPlanejado));
    }

    if (partial.paginaOrganograma) {
      payload.pagina_organograma = partial.paginaOrganograma;
    }

    const { error } = await supabase
      .from("organograma_manutencao_areas")
      .update(payload)
      .eq("id", area.id);

    if (error) {
      console.error(error);
      alert("Não foi possível salvar o ajuste da caixa.");
      return;
    }

    await carregarBase();
  }

  async function handleDeleteArea(area) {
    const confirmed = window.confirm(
      `Excluir "${area.titulo}" e toda a estrutura ligada a ela?`
    );
    if (!confirmed) return;

    const codes = Array.from(collectDescendantCodes(area.codigo, allChildrenMap));

    const pessoasResp = await supabase
      .from("organograma_manutencao_pessoas")
      .delete()
      .in("area_codigo", codes);

    if (pessoasResp.error) {
      console.error(pessoasResp.error);
      alert("Não foi possível excluir os registros de pessoas da estrutura.");
      return;
    }

    const areasResp = await supabase
      .from("organograma_manutencao_areas")
      .delete()
      .in("codigo", codes);

    if (areasResp.error) {
      console.error(areasResp.error);
      alert("Não foi possível excluir a estrutura.");
      return;
    }

    if (selecionada?.codigo && codes.includes(selecionada.codigo)) {
      setSelecionada(null);
    }

    await carregarBase();
  }

  async function handleSavePessoa(draft) {
    const siblings = pessoasAtivas.filter((item) => item.areaCodigo === draft.areaCodigo);
    const payload = {
      area_codigo: draft.areaCodigo,
      nome: draft.nome.trim(),
      cargo: draft.cargo.trim(),
      tipo_headcount: draft.tipoHeadcount,
      turno: draft.turno,
      status: draft.status.trim().toUpperCase() || "ATIVO",
      ordem: draft.id ? Number(draft.ordem || 0) : getNextOrdem(siblings),
      chapa: draft.chapa.trim(),
      telefone: draft.telefone.trim(),
      observacao: draft.observacao.trim(),
      ativo: true,
    };

    const query = draft.id
      ? supabase.from("organograma_manutencao_pessoas").update(payload).eq("id", draft.id)
      : supabase.from("organograma_manutencao_pessoas").insert(payload);

    const { error } = await query;
    if (error) {
      console.error(error);
      alert("Não foi possível salvar a pessoa/vaga.");
      return;
    }

    await carregarBase();
  }

  async function handleDeletePessoa(pessoa) {
    const confirmed = window.confirm(`Excluir "${pessoa.nome}"?`);
    if (!confirmed) return;

    const { error } = await supabase
      .from("organograma_manutencao_pessoas")
      .delete()
      .eq("id", pessoa.id);

    if (error) {
      console.error(error);
      alert("Não foi possível excluir a pessoa/vaga.");
      return;
    }

    await carregarBase();
  }

  async function handleImportModeloBase() {
    if (areasAtivas.length) {
      alert("O modelo base só pode ser importado quando a estrutura estiver vazia. Se quiser, limpe a página atual e tente de novo.");
      return;
    }

    const areasPayload = ORGANOGRAMA_FALLBACK_AREAS.map((area) => {
      const paginaOrganograma = String(
        area.paginaOrganograma ||
          (normalizeText(`${area.grupo} ${area.titulo} ${area.subtitulo}`).includes("pcm") ||
          normalizeText(`${area.grupo} ${area.titulo} ${area.subtitulo}`).includes("almox") ||
          normalizeText(`${area.grupo} ${area.titulo} ${area.subtitulo}`).includes("compr")
            ? "ADM"
            : "MANUTENCAO")
      ).toUpperCase();

      return {
        codigo: area.codigo,
        parent_codigo: area.parentCodigo || null,
        titulo: area.titulo,
        subtitulo: area.subtitulo || "",
        tipo: area.tipo,
        grupo: area.grupo || area.titulo,
        turno: area.turno || "GERAL",
        cor: area.cor || "stone",
        ordem: Number(area.ordem || 0),
        detalhe: area.detalhe || "",
        ativo: true,
        pagina_organograma: paginaOrganograma,
        orcado_planejado:
          area.orcadoQtd === null || area.orcadoQtd === undefined ? null : Number(area.orcadoQtd),
      };
    });

    const pessoasPayload = ORGANOGRAMA_FALLBACK_PESSOAS.map((pessoa) => ({
      area_codigo: pessoa.areaCodigo,
      nome: pessoa.nome,
      cargo: pessoa.cargo || "",
      tipo_headcount: pessoa.tipoHeadcount || "REALIZADO",
      turno: pessoa.turno || "GERAL",
      status: pessoa.status || "ATIVO",
      ordem: Number(pessoa.ordem || 0),
      chapa: pessoa.chapa || "",
      telefone: pessoa.telefone || "",
      observacao: pessoa.observacao || "",
      ativo: true,
    }));

    const insertAreas = await supabase.from("organograma_manutencao_areas").insert(areasPayload);
    if (insertAreas.error) {
      console.error(insertAreas.error);
      alert("Não foi possível importar o modelo base do Miro.");
      return;
    }

    const insertPessoas = await supabase.from("organograma_manutencao_pessoas").insert(pessoasPayload);
    if (insertPessoas.error) {
      console.error(insertPessoas.error);
      alert("As áreas foram criadas, mas houve erro ao importar as pessoas de exemplo.");
      await carregarBase();
      return;
    }

    await carregarBase();
  }

  async function handleClearPage() {
    const confirmed = window.confirm(
      `Limpar completamente a página ${PAGINAS.find((item) => item.value === activePage)?.label}?`
    );
    if (!confirmed) return;

    const codes = pageAreas.map((area) => area.codigo);
    if (!codes.length) return;

    const pessoasResp = await supabase
      .from("organograma_manutencao_pessoas")
      .delete()
      .in("area_codigo", codes);

    if (pessoasResp.error) {
      console.error(pessoasResp.error);
      alert("Não foi possível limpar as pessoas da página.");
      return;
    }

    const areasResp = await supabase
      .from("organograma_manutencao_areas")
      .delete()
      .in("codigo", codes);

    if (areasResp.error) {
      console.error(areasResp.error);
      alert("Não foi possível limpar a página.");
      return;
    }

    setSelecionada(null);
    await carregarBase();
  }

  const pageParentOptions = areasAtivas.filter(
    (area) => area.codigo !== editorState?.draft?.codigo && area.paginaOrganograma === editorState?.draft?.paginaOrganograma
  );

  return (
    <div className="min-h-screen space-y-5 bg-slate-100 p-4">
      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">
              <FaSitemap /> Builder do Organograma
            </div>
            <h1 className="mt-3 text-2xl font-black text-slate-800">Organograma</h1>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              Agora a montagem é separada em Manutenção, Operação e Adm, com possibilidade real de construir do zero.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setZoom((current) => Math.max(0.7, Number((current - 0.1).toFixed(2))))}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 hover:border-slate-400"
            >
              - Zoom
            </button>
            <button
              type="button"
              onClick={() => setZoom((current) => Math.min(1.4, Number((current + 0.1).toFixed(2))))}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 hover:border-slate-400"
            >
              + Zoom
            </button>
            <button
              type="button"
              onClick={() => setZoom(1)}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 hover:border-slate-400"
            >
              100%
            </button>
            <button
              type="button"
              onClick={carregarBase}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-800 bg-slate-800 px-4 py-2.5 text-sm font-black text-white transition hover:bg-slate-700 disabled:opacity-70"
            >
              <FaSync className={loading ? "animate-spin" : ""} />
              {loading ? "Atualizando..." : "Atualizar"}
            </button>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {PAGINAS.map((pagina) => {
            const active = activePage === pagina.value;
            return (
              <button
                key={pagina.value}
                type="button"
                onClick={() => setActivePage(pagina.value)}
                className={`rounded-2xl border px-4 py-2.5 text-sm font-black transition ${
                  active
                    ? "border-slate-900 bg-slate-900 text-white"
                    : `${pagina.tone} hover:border-slate-400`
                }`}
              >
                {pagina.label}
              </button>
            );
          })}
        </div>

        {feedback ? (
          <div
            className={`mt-4 rounded-2xl border px-4 py-3 text-sm font-bold ${
              feedback.type === "error"
                ? "border-rose-200 bg-rose-50 text-rose-700"
                : "border-blue-200 bg-blue-50 text-blue-700"
            }`}
          >
            {feedback.text}
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard title="Estruturas totais" value={fmtInt(totalAreas)} sub="Caixas cadastradas no organograma" tone="slate" />
        <KpiCard title="Orçado total" value={fmtInt(totalOrcado)} sub="Planejado em todas as páginas" tone="blue" />
        <KpiCard title="Realizado total" value={fmtInt(totalPessoas)} sub="Pessoas ativas cadastradas" tone="emerald" />
        <KpiCard title="Fonte" value={fonte} sub="Leitura e escrita no Supabase" tone="amber" />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[330px_1fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-slate-800">Construção da página</h2>
              <p className="text-xs font-semibold text-slate-500">
                Monte a página atual como no Miro, começando do zero se quiser.
              </p>
            </div>
            <span className={`rounded-full border px-3 py-1 text-xs font-black ${buildPaginaBadgeClasses(activePage)}`}>
              {PAGINAS.find((item) => item.value === activePage)?.label}
            </span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <KpiCard title="Caixas da página" value={fmtInt(pageStats.caixas)} sub="Hierarquia ativa" tone="slate" />
            <KpiCard title="Realizado" value={fmtInt(pageStats.realizado)} sub="Pessoas nesta página" tone="emerald" />
            <KpiCard title="Orçado" value={fmtInt(pageStats.orcado)} sub="Planejado nesta página" tone="blue" />
            <KpiCard title="Delta" value={fmtInt(pageStats.realizado - pageStats.orcado)} sub="Saldo da página" tone="amber" />
          </div>

          <div className="mt-4 space-y-2">
            <button
              type="button"
              onClick={openCreateRoot}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-black text-white hover:bg-slate-800"
            >
              <FaPlus /> Nova caixa no topo
            </button>
            <button
              type="button"
              onClick={handleImportModeloBase}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-black text-blue-700 hover:bg-blue-100"
            >
              <FaLayerGroup /> Importar modelo base
            </button>
            <button
              type="button"
              onClick={handleClearPage}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-black text-rose-700 hover:bg-rose-100"
            >
              <FaTrash /> Limpar página atual
            </button>
          </div>

          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="text-sm font-black text-slate-800">Como montar do zero</h3>
            <ol className="mt-2 space-y-2 text-sm font-semibold text-slate-600">
              <li>1. Escolha a página: Manutenção, Operação ou Adm.</li>
              <li>2. Crie a primeira caixa no topo.</li>
              <li>3. Adicione filhos para montar a árvore igual ao Miro.</li>
              <li>4. Entre no modal de pessoas para registrar realizado e orçado por equipe.</li>
            </ol>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b bg-slate-50 px-5 py-4">
            <h2 className="text-lg font-black text-slate-800">Canvas do organograma</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              Tela limpa por página, sem misturar áreas. Isso deixa a montagem mais próxima do quadro do Miro.
            </p>
          </div>

          <div className="bg-[linear-gradient(0deg,rgba(226,232,240,0.7)_1px,transparent_1px),linear-gradient(90deg,rgba(226,232,240,0.7)_1px,transparent_1px)] bg-[size:48px_48px] p-4 md:p-6">
            <div className="overflow-auto rounded-[36px] border border-white/80 bg-white/50 p-4 shadow-inner">
              <div
                className="inline-block min-w-full origin-top-left rounded-[32px] border border-white/80 bg-white/95 p-6 shadow-inner"
                style={{ transform: `scale(${zoom})` }}
              >
                <div className="mb-6">
                  <h3 className="text-3xl font-light tracking-tight text-slate-600">
                    Organograma {PAGINAS.find((item) => item.value === activePage)?.label}
                  </h3>
                  <p className="mt-2 text-sm font-semibold text-slate-500">
                    Monte a página atual como um quadro independente, com hierarquia própria e sem quebrar o desenho.
                  </p>
                </div>

                {roots.length ? (
                  <ul className="flex min-w-max items-start justify-center gap-12 pb-6">
                    {roots.map((root) => (
                      <TreeNode
                        key={root.codigo}
                        area={root}
                        childrenMap={pageChildrenMap}
                        metricsMap={pageMetricsMap}
                        onOpenPeople={setSelecionada}
                        onEdit={openEditArea}
                        onAddChild={openCreateChild}
                        onDelete={handleDeleteArea}
                        isRoot
                      />
                    ))}
                  </ul>
                ) : (
                  <div className="rounded-[28px] border border-dashed border-slate-300 bg-slate-50 px-6 py-16 text-center">
                    <div className="mx-auto max-w-xl">
                      <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${buildPaginaBadgeClasses(activePage)}`}>
                        {PAGINAS.find((item) => item.value === activePage)?.label}
                      </span>
                      <h4 className="mt-4 text-2xl font-black text-slate-800">
                        Página vazia para construir do zero
                      </h4>
                      <p className="mt-2 text-sm font-semibold text-slate-500">
                        Esse espaço foi deixado limpo para você montar exatamente como no Miro, sem estrutura fixa pré-imposta.
                      </p>
                      <button
                        type="button"
                        onClick={openCreateRoot}
                        className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-black text-white hover:bg-slate-800"
                      >
                        <FaPlus /> Criar primeira caixa
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {editorState ? (
        <AreaEditorModal
          mode={editorState.mode}
          draft={editorState.draft}
          parentOptions={pageParentOptions}
          onChange={handleEditorChange}
          onClose={() => setEditorState(null)}
          onSave={handleSaveAreaDraft}
        />
      ) : null}

      {selecionada ? (
        <PessoasModal
          area={areasByCode.get(selecionada.codigo) || selecionada}
          areasByCode={areasByCode}
          childrenMap={allChildrenMap}
          metricsMap={buildMetricsMap(areasAtivas, pessoasAtivas, allChildrenMap)}
          pessoas={pessoasAtivas}
          onClose={() => setSelecionada(null)}
          onSaveArea={handleSaveAreaPatch}
          onSavePessoa={handleSavePessoa}
          onDeletePessoa={handleDeletePessoa}
        />
      ) : null}
    </div>
  );
}
