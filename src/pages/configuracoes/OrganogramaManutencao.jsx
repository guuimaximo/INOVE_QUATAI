import { useEffect, useMemo, useState } from "react";
import {
  FaClipboardList,
  FaLayerGroup,
  FaSearch,
  FaSitemap,
  FaSync,
  FaTimes,
  FaUserTie,
  FaUsers,
} from "react-icons/fa";
import { supabase } from "../../supabase";
import {
  ORGANOGRAMA_FALLBACK_AREAS,
  ORGANOGRAMA_FALLBACK_PESSOAS,
} from "./organogramaManutencaoModel";

const ORGANOGRAMA_PAGINAS = [
  { value: "MANUTENCAO", label: "Manutencao" },
  { value: "OPERACAO", label: "Operacao" },
  { value: "ADM", label: "Adm" },
];

const ORGANOGRAMA_CONFIG_STORAGE_KEY = "inove_organograma_config_v1";

function normalizeText(value = "") {
  return String(value || "").trim().toLowerCase();
}

function fmtInt(value) {
  return Math.round(Number(value || 0)).toLocaleString("pt-BR");
}

function clampZoom(value) {
  return Math.min(1.5, Math.max(0.65, Number(value || 1)));
}

function getAreaWidthClass(sizeMode = "standard") {
  if (sizeMode === "compact") return "w-48";
  if (sizeMode === "expanded") return "w-64";
  return "w-56";
}

function getTreeGapClass(sizeMode = "standard") {
  if (sizeMode === "compact") return "gap-2";
  if (sizeMode === "expanded") return "gap-5";
  return "gap-3";
}

function getRootGapClass(sizeMode = "standard") {
  if (sizeMode === "compact") return "gap-8";
  if (sizeMode === "expanded") return "gap-16";
  return "gap-12";
}

function getCanvasPreset(sizeMode = "standard") {
  if (sizeMode === "compact") {
    return { width: 1480, height: 760 };
  }

  if (sizeMode === "expanded") {
    return { width: 2100, height: 980 };
  }

  return { width: 1780, height: 860 };
}

function inferPaginaOrganograma(area) {
  const blob = normalizeText(`${area?.titulo || ""} ${area?.subtitulo || ""} ${area?.grupo || ""}`);

  if (
    blob.includes("planejamento") ||
    blob.includes("suprimentos") ||
    blob.includes("compras") ||
    blob.includes("almox") ||
    blob.includes("administrativo") ||
    blob.includes("pcm")
  ) {
    return "ADM";
  }

  if (
    blob.includes("entrada/saida") ||
    blob.includes("entrada") ||
    blob.includes("saida") ||
    blob.includes("operacao")
  ) {
    return "OPERACAO";
  }

  return "MANUTENCAO";
}

function readStoredOrganogramaConfig() {
  if (typeof window === "undefined") return {};

  try {
    const raw = window.localStorage.getItem(ORGANOGRAMA_CONFIG_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (error) {
    console.warn("Falha ao ler config local do organograma:", error);
    return {};
  }
}

function buildAreaTone(color = "stone") {
  const tones = {
    stone: {
      card: "border-stone-300 bg-stone-50 text-stone-800",
      badge: "bg-stone-100 text-stone-700 border-stone-200",
      ribbon: "from-stone-200 to-stone-100 text-stone-700",
    },
    emerald: {
      card: "border-emerald-300 bg-emerald-50 text-emerald-900",
      badge: "bg-emerald-100 text-emerald-700 border-emerald-200",
      ribbon: "from-emerald-300 to-teal-200 text-emerald-900",
    },
    blue: {
      card: "border-blue-300 bg-blue-50 text-blue-900",
      badge: "bg-blue-100 text-blue-700 border-blue-200",
      ribbon: "from-blue-400 to-blue-300 text-white",
    },
    amber: {
      card: "border-amber-300 bg-amber-50 text-amber-900",
      badge: "bg-amber-100 text-amber-700 border-amber-200",
      ribbon: "from-amber-300 to-yellow-200 text-amber-900",
    },
    sky: {
      card: "border-sky-300 bg-sky-50 text-sky-900",
      badge: "bg-sky-100 text-sky-700 border-sky-200",
      ribbon: "from-sky-300 to-blue-200 text-sky-900",
    },
    orange: {
      card: "border-orange-300 bg-orange-50 text-orange-900",
      badge: "bg-orange-100 text-orange-700 border-orange-200",
      ribbon: "from-orange-300 to-orange-200 text-orange-900",
    },
  };

  return tones[color] || tones.stone;
}

function normalizeArea(row) {
  return {
    codigo: String(row?.codigo || "").trim(),
    parentCodigo: row?.parent_codigo ?? row?.parentCodigo ?? null,
    titulo: String(row?.titulo || "").trim(),
    subtitulo: String(row?.subtitulo || "").trim(),
    tipo: String(row?.tipo || "CELULA").trim().toUpperCase(),
    grupo: String(row?.grupo || "").trim(),
    turno: String(row?.turno || "").trim().toUpperCase(),
    cor: String(row?.cor || "stone").trim().toLowerCase(),
    ordem: Number(row?.ordem || 0),
    detalhe: String(row?.detalhe || "").trim(),
    ativo: row?.ativo !== false,
  };
}

function normalizePessoa(row) {
  return {
    id: row?.id ?? `${row?.area_codigo || row?.areaCodigo}-${row?.nome}-${row?.tipo_headcount}`,
    areaCodigo: String(row?.area_codigo ?? row?.areaCodigo ?? "").trim(),
    nome: String(row?.nome || "").trim(),
    cargo: String(row?.cargo || "").trim(),
    tipoHeadcount: String(row?.tipo_headcount ?? row?.tipoHeadcount ?? "REALIZADO")
      .trim()
      .toUpperCase(),
    turno: String(row?.turno || "").trim().toUpperCase(),
    status: String(row?.status || "").trim().toUpperCase(),
    ordem: Number(row?.ordem || 0),
    chapa: String(row?.chapa || "").trim(),
    telefone: String(row?.telefone || "").trim(),
    observacao: String(row?.observacao || "").trim(),
    ativo: row?.ativo !== false,
  };
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
        orcado: 0,
        realizado: 0,
      },
    ])
  );

  pessoas.forEach((pessoa) => {
    if (!pessoa.ativo || !directMap.has(pessoa.areaCodigo)) return;
    const entry = directMap.get(pessoa.areaCodigo);
    if (pessoa.tipoHeadcount === "ORCADO") entry.orcado += 1;
    if (pessoa.tipoHeadcount === "REALIZADO") entry.realizado += 1;
  });

  const cache = new Map();

  function aggregate(areaCode) {
    if (cache.has(areaCode)) return cache.get(areaCode);

    const base = directMap.get(areaCode) || { orcado: 0, realizado: 0 };
    const totals = { ...base };
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

function resolveAreaMetrics(area, metricsMap, configAreaMap) {
  const base = metricsMap.get(area.codigo) || { orcado: 0, realizado: 0 };
  const override = configAreaMap?.[area.codigo]?.orcadoManual;

  if (override === "" || override === null || override === undefined) {
    return base;
  }

  const normalized = Number(override);
  if (!Number.isFinite(normalized)) return base;

  return {
    ...base,
    orcado: normalized,
  };
}

function buildPageBadgeClasses(value) {
  if (value === "ADM") return "border-violet-200 bg-violet-50 text-violet-700";
  if (value === "OPERACAO") return "border-sky-200 bg-sky-50 text-sky-700";
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

function KpiCard({ title, value, sub, icon, tone = "slate" }) {
  const tones = {
    slate: "from-slate-50 to-white border-slate-200 text-slate-700",
    emerald: "from-emerald-50 to-teal-50 border-emerald-200 text-emerald-700",
    blue: "from-blue-50 to-cyan-50 border-blue-200 text-blue-700",
    amber: "from-amber-50 to-yellow-50 border-amber-200 text-amber-700",
  };

  return (
    <div className={`rounded-2xl border bg-gradient-to-br ${tones[tone]} p-4 shadow-sm`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-wider opacity-80">{title}</p>
          <p className="mt-2 text-2xl font-black text-slate-800">{value}</p>
          {sub ? <p className="mt-1 text-xs font-bold opacity-80">{sub}</p> : null}
        </div>
        <div className="text-lg opacity-80">{icon}</div>
      </div>
    </div>
  );
}

function AreaCard({ area, metrics, onOpen, paginaOrganograma, sizeMode = "standard" }) {
  const tone = buildAreaTone(area.cor);

  return (
    <button
      type="button"
      onClick={() => onOpen(area)}
      className={`${getAreaWidthClass(sizeMode)} rounded-2xl border px-4 py-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${tone.card}`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-wider ${tone.badge}`}>
          {area.tipo === "GESTAO" ? "Lideranca" : area.tipo === "SQUAD" ? "Equipe" : "Celula"}
        </span>
        <div className="flex flex-col items-end gap-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
            {area.turno || "GERAL"}
          </span>
          <span className={`inline-flex rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${buildPageBadgeClasses(paginaOrganograma)}`}>
            {ORGANOGRAMA_PAGINAS.find((item) => item.value === paginaOrganograma)?.label || "Manutencao"}
          </span>
        </div>
      </div>

      <h3 className="mt-3 text-sm font-black leading-tight">{area.titulo}</h3>
      <p className="mt-1 text-[11px] font-semibold text-slate-600">{area.subtitulo || area.detalhe || "-"}</p>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-white/60 bg-white/70 px-3 py-2">
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Orcado</p>
          <p className="mt-1 text-base font-black text-slate-800">{fmtInt(metrics?.orcado)}</p>
        </div>
        <div className="rounded-xl border border-white/60 bg-white/70 px-3 py-2">
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Realizado</p>
          <p className="mt-1 text-base font-black text-slate-800">{fmtInt(metrics?.realizado)}</p>
        </div>
      </div>
    </button>
  );
}

function TreeNode({
  area,
  childrenMap,
  metricsMap,
  onOpen,
  configAreaMap,
  sizeMode = "standard",
  isRoot = false,
}) {
  const children = childrenMap.get(area.codigo) || [];

  return (
    <li className="relative flex flex-col items-center px-3">
      {!isRoot ? (
        <span className="absolute left-1/2 top-0 h-6 -translate-x-1/2 border-l border-slate-300" />
      ) : null}

      <AreaCard
        area={area}
        metrics={resolveAreaMetrics(area, metricsMap, configAreaMap)}
        onOpen={onOpen}
        paginaOrganograma={configAreaMap?.[area.codigo]?.paginaOrganograma || inferPaginaOrganograma(area)}
        sizeMode={sizeMode}
      />

      {children.length ? (
        <div className="relative mt-6 flex justify-center">
          <span className="absolute left-1/2 top-0 h-6 -translate-x-1/2 border-l border-slate-300" />
          {children.length > 1 ? (
            <span className="absolute left-10 right-10 top-0 border-t border-slate-300" />
          ) : null}

          <ul className={`flex items-start justify-center ${getTreeGapClass(sizeMode)} pt-6`}>
            {children.map((child) => (
              <TreeNode
                key={child.codigo}
                area={child}
                childrenMap={childrenMap}
                metricsMap={metricsMap}
                onOpen={onOpen}
                configAreaMap={configAreaMap}
                sizeMode={sizeMode}
              />
            ))}
          </ul>
        </div>
      ) : null}
    </li>
  );
}

function MobileAreaSection({ area, childrenMap, metricsMap, onOpen, configAreaMap }) {
  const children = childrenMap.get(area.codigo) || [];
  const tone = buildAreaTone(area.cor);

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className={`rounded-2xl border bg-gradient-to-r px-4 py-3 ${tone.card}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider">{area.grupo || area.tipo}</p>
            <h3 className="mt-1 text-base font-black">{area.titulo}</h3>
            <p className="text-xs font-semibold text-slate-600">{area.subtitulo || area.detalhe || "-"}</p>
          </div>
          <button
            type="button"
            onClick={() => onOpen(area)}
            className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-black text-white hover:bg-slate-800"
          >
            Ver pessoas
          </button>
        </div>
      </div>

      {children.length ? (
        <div className="mt-4 grid grid-cols-1 gap-3">
          {children.map((child) => (
            <AreaCard
              key={child.codigo}
              area={child}
              metrics={resolveAreaMetrics(child, metricsMap, configAreaMap)}
              onOpen={onOpen}
              paginaOrganograma={configAreaMap?.[child.codigo]?.paginaOrganograma || inferPaginaOrganograma(child)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function PessoasModal({
  area,
  areasByCode,
  childrenMap,
  metricsMap,
  pessoas,
  areaConfig,
  onConfigChange,
  onClose,
}) {
  const [busca, setBusca] = useState("");
  const [tipoFiltro, setTipoFiltro] = useState("");

  const descendantCodes = useMemo(
    () => collectDescendantCodes(area.codigo, childrenMap),
    [area.codigo, childrenMap]
  );

  const registros = useMemo(() => {
    const term = normalizeText(busca);

    return pessoas
      .filter((pessoa) => descendantCodes.has(pessoa.areaCodigo))
      .filter((pessoa) => {
        if (tipoFiltro && pessoa.tipoHeadcount !== tipoFiltro) return false;
        if (!term) return true;
        const blob = `${pessoa.nome} ${pessoa.cargo} ${pessoa.areaCodigo} ${pessoa.status}`;
        return normalizeText(blob).includes(term);
      })
      .sort((a, b) => {
        if (a.tipoHeadcount !== b.tipoHeadcount) return a.tipoHeadcount.localeCompare(b.tipoHeadcount);
        const areaA = areasByCode.get(a.areaCodigo)?.ordem || 0;
        const areaB = areasByCode.get(b.areaCodigo)?.ordem || 0;
        return areaA - areaB || a.ordem - b.ordem || a.nome.localeCompare(b.nome, "pt-BR");
      });
  }, [areasByCode, busca, descendantCodes, pessoas, tipoFiltro]);

  const metrics = resolveAreaMetrics(
    area,
    metricsMap,
    areaConfig ? { [area.codigo]: areaConfig } : {}
  );
  const delta = metrics.realizado - metrics.orcado;
  const paginaOrganograma = areaConfig?.paginaOrganograma || inferPaginaOrganograma(area);
  const orcadoManual = areaConfig?.orcadoManual ?? "";

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b bg-slate-50 px-5 py-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-blue-700">
              <FaUsers /> Modal de Pessoas
            </div>
            <h2 className="mt-3 text-xl font-black text-slate-800">{area.titulo}</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              {area.subtitulo || area.detalhe || "Consulta consolidada de headcount por equipe."}
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
          <KpiCard title="Orcado" value={fmtInt(metrics.orcado)} sub="Cadeiras planejadas" icon={<FaClipboardList />} tone="blue" />
          <KpiCard title="Realizado" value={fmtInt(metrics.realizado)} sub="Pessoas em operacao" icon={<FaUsers />} tone="emerald" />
          <KpiCard title="Delta" value={delta >= 0 ? `+${fmtInt(delta)}` : fmtInt(delta)} sub="Realizado menos orcado" icon={<FaLayerGroup />} tone="amber" />
          <KpiCard title="Abrangencia" value={fmtInt(descendantCodes.size)} sub="Areas cobertas na consulta" icon={<FaSitemap />} tone="slate" />
        </div>

        <div className="grid grid-cols-1 gap-4 border-b bg-slate-50 px-5 py-4 xl:grid-cols-[1.4fr_0.8fr]">
          <div>
            <label className="mb-2 block text-[10px] font-black uppercase tracking-wider text-slate-500">
              Pagina Organograma
            </label>
            <div className="flex flex-wrap gap-2">
              {ORGANOGRAMA_PAGINAS.map((item) => {
                const active = paginaOrganograma === item.value;
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => onConfigChange(area.codigo, { paginaOrganograma: item.value })}
                    className={`rounded-2xl border px-4 py-2 text-sm font-black transition ${
                      active
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 bg-white text-slate-700 hover:border-slate-400"
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-[10px] font-black uppercase tracking-wider text-slate-500">
              Campo Orcado
            </label>
            <input
              type="number"
              min="0"
              step="1"
              value={orcadoManual}
              onChange={(event) =>
                onConfigChange(area.codigo, {
                  orcadoManual:
                    event.target.value === "" ? "" : Math.max(0, Number(event.target.value)),
                })
              }
              placeholder="Inserir orcado"
              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-black text-slate-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
            />
            <p className="mt-2 text-xs font-semibold text-slate-500">
              Se preencher aqui, esse valor passa a ser o orcado exibido para esta equipe no organograma.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 border-b bg-white px-5 py-4 md:grid-cols-3">
          <div className="md:col-span-2">
            <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-500">
              Buscar pessoa ou vaga
            </label>
            <div className="relative">
              <FaSearch className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={busca}
                onChange={(event) => setBusca(event.target.value)}
                placeholder="Nome, cargo, area ou status..."
                className="w-full rounded-2xl border border-slate-300 bg-white py-2.5 pl-11 pr-4 text-sm font-bold text-slate-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-500">
              Tipo
            </label>
            <select
              value={tipoFiltro}
              onChange={(event) => setTipoFiltro(event.target.value)}
              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
            >
              <option value="">Todos</option>
              <option value="ORCADO">Orcado</option>
              <option value="REALIZADO">Realizado</option>
            </select>
          </div>
        </div>

        <div className="flex-1 overflow-auto px-5 py-4">
          <div className="overflow-x-auto">
            <table className="min-w-[980px] w-full text-left text-sm">
              <thead className="border-b bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="p-3">Pessoa / Vaga</th>
                  <th className="p-3">Cargo</th>
                  <th className="p-3">Area</th>
                  <th className="p-3">Turno</th>
                  <th className="p-3">Tipo</th>
                  <th className="p-3">Status</th>
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
                      <td className="p-3">
                        <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-black text-slate-700">
                          {areaPessoa?.titulo || pessoa.areaCodigo}
                        </span>
                      </td>
                      <td className="p-3 font-semibold text-slate-600">{pessoa.turno || areaPessoa?.turno || "-"}</td>
                      <td className="p-3">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-black ${
                            isOrcado
                              ? "border-blue-200 bg-blue-50 text-blue-700"
                              : "border-emerald-200 bg-emerald-50 text-emerald-700"
                          }`}
                        >
                          {isOrcado ? "Orcado" : "Realizado"}
                        </span>
                      </td>
                      <td className="p-3 font-semibold text-slate-700">{pessoa.status || "-"}</td>
                    </tr>
                  );
                })}

                {registros.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-sm font-bold text-slate-400">
                      Nenhum registro encontrado para os filtros aplicados.
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
    </div>
  );
}

export default function OrganogramaManutencao({ embedded = false }) {
  const [areas, setAreas] = useState([]);
  const [pessoas, setPessoas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fonte, setFonte] = useState("fallback");
  const [feedback, setFeedback] = useState(null);
  const [selecionada, setSelecionada] = useState(null);
  const [configAreaMap, setConfigAreaMap] = useState(() => readStoredOrganogramaConfig());
  const [zoom, setZoom] = useState(1);
  const [sizeMode, setSizeMode] = useState("standard");

  useEffect(() => {
    try {
      window.localStorage.setItem(ORGANOGRAMA_CONFIG_STORAGE_KEY, JSON.stringify(configAreaMap));
    } catch (error) {
      console.warn("Falha ao salvar config local do organograma:", error);
    }
  }, [configAreaMap]);

  function handleConfigAreaChange(areaCodigo, partial) {
    setConfigAreaMap((current) => ({
      ...current,
      [areaCodigo]: {
        ...current[areaCodigo],
        ...partial,
      },
    }));
  }

  async function carregarBase() {
    setLoading(true);
    setFeedback(null);

    try {
      const [areasResp, pessoasResp] = await Promise.all([
        supabase.from("organograma_manutencao_areas").select("*").eq("ativo", true),
        supabase.from("organograma_manutencao_pessoas").select("*").eq("ativo", true),
      ]);

      const areasDb = areasResp.error ? [] : (areasResp.data || []).map(normalizeArea).filter((item) => item.codigo);
      const pessoasDb = pessoasResp.error
        ? []
        : (pessoasResp.data || []).map(normalizePessoa).filter((item) => item.areaCodigo);

      if (areasDb.length) {
        setAreas(areasDb);
        setPessoas(pessoasDb.length ? pessoasDb : ORGANOGRAMA_FALLBACK_PESSOAS);
        setFonte(pessoasDb.length ? "supabase" : "mista");

        if (!pessoasDb.length) {
          setFeedback({
            type: "warning",
            text: "Estrutura carregada do Supabase. Como a tabela de pessoas ainda esta vazia, o modal usa uma base demonstrativa local.",
          });
        }
      } else {
        setAreas(ORGANOGRAMA_FALLBACK_AREAS);
        setPessoas(ORGANOGRAMA_FALLBACK_PESSOAS);
        setFonte("fallback");
        setFeedback({
          type: "info",
          text: "Usando a estrutura base local. Assim que as tabelas do organograma forem preenchidas, esta tela passa a refletir a base real automaticamente.",
        });
      }
    } catch (error) {
      console.error("Falha ao carregar organograma:", error);
      setAreas(ORGANOGRAMA_FALLBACK_AREAS);
      setPessoas(ORGANOGRAMA_FALLBACK_PESSOAS);
      setFonte("fallback");
      setFeedback({
        type: "error",
        text: "Nao foi possivel consultar o Supabase agora. A tela ficou em modo demonstrativo local.",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void carregarBase();
  }, []);

  const areasAtivas = useMemo(
    () => (areas || []).filter((area) => area.ativo !== false),
    [areas]
  );

  const peopleAtivos = useMemo(
    () => (pessoas || []).filter((pessoa) => pessoa.ativo !== false),
    [pessoas]
  );

  const childrenMap = useMemo(() => buildChildrenMap(areasAtivas), [areasAtivas]);
  const areasByCode = useMemo(
    () => new Map(areasAtivas.map((area) => [area.codigo, area])),
    [areasAtivas]
  );
  const metricsMap = useMemo(
    () => buildMetricsMap(areasAtivas, peopleAtivos, childrenMap),
    [areasAtivas, childrenMap, peopleAtivos]
  );
  const roots = useMemo(() => childrenMap.get("__ROOT__") || [], [childrenMap]);

  const cells = useMemo(
    () => areasAtivas.filter((area) => area.tipo === "CELULA"),
    [areasAtivas]
  );

  const totalOrcado = useMemo(
    () => peopleAtivos.filter((pessoa) => pessoa.tipoHeadcount === "ORCADO").length,
    [peopleAtivos]
  );
  const totalRealizado = useMemo(
    () => peopleAtivos.filter((pessoa) => pessoa.tipoHeadcount === "REALIZADO").length,
    [peopleAtivos]
  );

  const equipesDiurnas = useMemo(
    () => areasAtivas.filter((area) => area.tipo === "SQUAD" && area.turno === "DIURNA"),
    [areasAtivas]
  );

  const equipesNoturnas = useMemo(
    () => areasAtivas.filter((area) => area.tipo === "SQUAD" && area.turno === "NOTURNA"),
    [areasAtivas]
  );

  const canvasPreset = useMemo(() => getCanvasPreset(sizeMode), [sizeMode]);
  const canvasWidth = Math.round(canvasPreset.width * zoom);
  const canvasHeight = Math.round(canvasPreset.height * zoom);
  const wrapperClass = embedded ? "space-y-5" : "min-h-screen bg-slate-100 p-4 space-y-5";

  return (
    <div className={wrapperClass}>
      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">
              <FaSitemap /> Estrutura de Pessoas
            </div>
            <h1 className="mt-3 text-2xl font-black text-slate-800">
              {embedded ? "Organograma dentro do Modal de Pessoas" : "Organograma Manutencao"}
            </h1>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              Estrutura preparada para o gestor navegar, aumentar, reduzir e abrir cada equipe com orcado x realizado.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setZoom((current) => clampZoom(current - 0.1))}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 transition hover:border-slate-400"
            >
              - Zoom
            </button>
            <button
              type="button"
              onClick={() => setZoom((current) => clampZoom(current + 0.1))}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 transition hover:border-slate-400"
            >
              + Zoom
            </button>
            <button
              type="button"
              onClick={() => {
                setZoom(1);
                setSizeMode("standard");
              }}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 transition hover:border-slate-400"
            >
              100%
            </button>
            <button
              type="button"
              onClick={() => {
                setZoom(0.85);
                setSizeMode("compact");
              }}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 transition hover:border-slate-400"
            >
              Ajustar tela
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

        <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-[1fr_auto] xl:items-end">
          <div>
            <label className="mb-2 block text-[10px] font-black uppercase tracking-wider text-slate-500">
              Zoom do organograma
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="0.65"
                max="1.5"
                step="0.05"
                value={zoom}
                onChange={(event) => setZoom(clampZoom(event.target.value))}
                className="w-full accent-blue-600"
              />
              <span className="min-w-[68px] rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-center text-sm font-black text-slate-700">
                {Math.round(zoom * 100)}%
              </span>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-[10px] font-black uppercase tracking-wider text-slate-500">
              Tamanho visual
            </label>
            <div className="flex flex-wrap gap-2">
              {[
                { value: "compact", label: "Compacto" },
                { value: "standard", label: "Padrao" },
                { value: "expanded", label: "Amplo" },
              ].map((item) => {
                const active = sizeMode === item.value;
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setSizeMode(item.value)}
                    className={`rounded-2xl border px-4 py-2 text-sm font-black transition ${
                      active
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 bg-white text-slate-700 hover:border-slate-400"
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {feedback ? (
          <div
            className={`mt-4 rounded-2xl border px-4 py-3 text-sm font-bold ${
              feedback.type === "error"
                ? "border-rose-200 bg-rose-50 text-rose-700"
                : feedback.type === "warning"
                ? "border-amber-200 bg-amber-50 text-amber-700"
                : "border-blue-200 bg-blue-50 text-blue-700"
            }`}
          >
            {feedback.text}
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard title="Areas no mapa" value={fmtInt(areasAtivas.length)} sub={`${fmtInt(cells.length)} celulas operacionais`} icon={<FaLayerGroup />} tone="slate" />
        <KpiCard title="Orcado total" value={fmtInt(totalOrcado)} sub="Vagas planejadas no organograma" icon={<FaClipboardList />} tone="blue" />
        <KpiCard title="Realizado total" value={fmtInt(totalRealizado)} sub="Pessoas atualmente mapeadas" icon={<FaUsers />} tone="emerald" />
        <KpiCard title="Fonte atual" value={fonte.toUpperCase()} sub="Supabase ou fallback local" icon={<FaUserTie />} tone="amber" />
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b bg-slate-50 px-5 py-4">
          <h2 className="text-lg font-black text-slate-800">Organograma visual</h2>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            Clique nas caixas para abrir o modal de pessoas. Use zoom, tamanho visual e rolagem para navegar como um quadro vivo.
          </p>
        </div>

        <div className="bg-[linear-gradient(0deg,rgba(226,232,240,0.7)_1px,transparent_1px),linear-gradient(90deg,rgba(226,232,240,0.7)_1px,transparent_1px)] bg-[size:48px_48px] p-4 md:p-6">
          <div className="hidden lg:block">
            <div className="overflow-auto rounded-[36px] border border-white/80 bg-white/40 p-3 shadow-inner">
              <div className="mx-auto" style={{ width: `${canvasWidth}px`, minHeight: `${canvasHeight}px` }}>
                <div
                  className="origin-top-left rounded-[36px] border border-white/80 bg-white/90 p-6 shadow-inner"
                  style={{
                    width: `${canvasPreset.width}px`,
                    minHeight: `${canvasPreset.height}px`,
                    transform: `scale(${zoom})`,
                  }}
                >
                  <div className="mb-6">
                    <h3 className="text-3xl font-light tracking-tight text-slate-600">Organograma Manutencao</h3>
                    <p className="mt-2 text-sm font-semibold text-slate-500">
                      Estrutura inspirada no quadro operacional do Miro, agora dentro do fluxo de Pessoas e com ajuste dinamico de tela.
                    </p>
                  </div>

                  <ul className={`flex items-start justify-center ${getRootGapClass(sizeMode)} pb-6`}>
                    {roots.map((root) => (
                      <TreeNode
                        key={root.codigo}
                        area={root}
                        childrenMap={childrenMap}
                        metricsMap={metricsMap}
                        onOpen={setSelecionada}
                        configAreaMap={configAreaMap}
                        sizeMode={sizeMode}
                        isRoot
                      />
                    ))}
                  </ul>

                  <div className="mt-8 space-y-4">
                    <div className="grid grid-cols-5 gap-3">
                      {areasAtivas
                        .filter((area) => area.tipo === "SQUAD")
                        .map((area) => {
                          const tone = buildAreaTone(area.cor);
                          const metrics = resolveAreaMetrics(area, metricsMap, configAreaMap);

                          return (
                            <button
                              key={area.codigo}
                              type="button"
                              onClick={() => setSelecionada(area)}
                              className={`rounded-full border bg-gradient-to-r px-5 py-3 text-center text-sm font-black shadow-sm transition hover:-translate-y-0.5 ${tone.ribbon}`}
                            >
                              <span>{area.titulo}</span>
                              <span className="ml-2 text-xs font-semibold opacity-80">
                                {fmtInt(metrics.realizado)}/{fmtInt(metrics.orcado)}
                              </span>
                            </button>
                          );
                        })}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="rounded-full border border-emerald-300 bg-emerald-200/90 px-6 py-4 text-center text-[34px] font-black tracking-tight text-emerald-950 shadow-sm">
                        EQUIPE DIURNA
                      </div>
                      <div className="rounded-full border border-blue-300 bg-blue-200/90 px-6 py-4 text-center text-[34px] font-black tracking-tight text-blue-950 shadow-sm">
                        EQUIPE NOTURNA
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4 lg:hidden">
            <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700">
              No mobile, o organograma abre em blocos responsivos. O modal de pessoas continua igual, com orcado, realizado e busca.
            </div>

            {roots.map((root) => (
              <MobileAreaSection
                key={root.codigo}
                area={root}
                childrenMap={childrenMap}
                metricsMap={metricsMap}
                onOpen={setSelecionada}
                configAreaMap={configAreaMap}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-black text-slate-800">Equipe diurna</h3>
              <p className="text-xs font-semibold text-slate-500">Resumo das frentes do turno principal.</p>
            </div>
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">
              {fmtInt(
                equipesDiurnas.reduce(
                  (acc, area) => acc + resolveAreaMetrics(area, metricsMap, configAreaMap).realizado,
                  0
                )
              )} pessoas
            </span>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            {equipesDiurnas.map((area) => (
              <AreaCard
                key={area.codigo}
                area={area}
                metrics={resolveAreaMetrics(area, metricsMap, configAreaMap)}
                onOpen={setSelecionada}
                paginaOrganograma={configAreaMap?.[area.codigo]?.paginaOrganograma || inferPaginaOrganograma(area)}
              />
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-black text-slate-800">Equipe noturna</h3>
              <p className="text-xs font-semibold text-slate-500">Frentes de limpeza, melhorias e apoio.</p>
            </div>
            <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">
              {fmtInt(
                equipesNoturnas.reduce(
                  (acc, area) => acc + resolveAreaMetrics(area, metricsMap, configAreaMap).realizado,
                  0
                )
              )} pessoas
            </span>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            {equipesNoturnas.map((area) => (
              <AreaCard
                key={area.codigo}
                area={area}
                metrics={resolveAreaMetrics(area, metricsMap, configAreaMap)}
                onOpen={setSelecionada}
                paginaOrganograma={configAreaMap?.[area.codigo]?.paginaOrganograma || inferPaginaOrganograma(area)}
              />
            ))}
          </div>
        </div>
      </div>

      {selecionada ? (
        <PessoasModal
          area={selecionada}
          areasByCode={areasByCode}
          childrenMap={childrenMap}
          metricsMap={metricsMap}
          pessoas={peopleAtivos}
          areaConfig={configAreaMap?.[selecionada.codigo] || null}
          onConfigChange={handleConfigAreaChange}
          onClose={() => setSelecionada(null)}
        />
      ) : null}
    </div>
  );
}
