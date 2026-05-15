import { useContext, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaCheckCircle,
  FaDownload,
  FaIdBadge,
  FaSearch,
  FaSitemap,
  FaSync,
  FaTimes,
  FaUserTimes,
  FaUsers,
} from "react-icons/fa";
import { AuthContext } from "../../context/AuthContext";
import { supabase } from "../../supabase";
import { supabaseBCNT } from "../../supabaseBCNT";

function normalizeText(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function formatDateBR(value) {
  if (!value) return "-";
  const raw = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [year, month, day] = raw.split("-");
    return `${day}/${month}/${year}`;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

function calcTempoEmpresa(dataInicio) {
  if (!dataInicio) return "";
  const inicio = new Date(dataInicio);
  if (Number.isNaN(inicio.getTime())) return "";
  const agora = new Date();
  let anos = agora.getFullYear() - inicio.getFullYear();
  let meses = agora.getMonth() - inicio.getMonth();
  if (agora.getDate() < inicio.getDate()) meses -= 1;
  if (meses < 0) {
    anos -= 1;
    meses += 12;
  }
  if (anos <= 0 && meses <= 0) return "< 1 mes";
  const parts = [];
  if (anos > 0) parts.push(`${anos}a`);
  if (meses > 0) parts.push(`${meses}m`);
  return parts.join(" ");
}

function fmtInt(v) {
  return Math.round(Number(v || 0)).toLocaleString("pt-BR");
}

function buildFuncionarioKey(value) {
  return String(
    value?.id_funcionario ||
      value?.funcionario_id ||
      value?.nr_cracha ||
      value?.funcionario_cracha ||
      normalizeText(value?.nm_funcionario || value?.nome) ||
      ""
  );
}

function exportarCSV(dados, nomeArquivo) {
  if (!dados?.length) {
    alert("Nao ha dados para exportar.");
    return;
  }

  const cabecalho = [
    "ID",
    "Cracha",
    "Nome",
    "Funcao",
    "Telefone",
    "Admissao",
    "Tempo",
    "Alocacao",
    "Area",
    "Afastado",
    "Motivo afastamento",
  ];

  const linhas = dados.map((d) => [
    d.id_funcionario || "",
    d.nr_cracha || "",
    d.nm_funcionario || "",
    d.nm_funcao || "",
    d.nr_telefone_celular || "",
    formatDateBR(d.dt_inicio_atividade),
    calcTempoEmpresa(d.dt_inicio_atividade),
    d._alocacao || "Sobrando",
    d._area_titulo || "",
    d._afastado ? "SIM" : "NAO",
    d._afastamento?.motivo || "",
  ]);

  const csv = [cabecalho, ...linhas]
    .map((row) => row.map((cell) => `"${String(cell || "").replace(/"/g, '""')}"`).join(";"))
    .join("\n");

  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${nomeArquivo}_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function CardKPI({ titulo, valor, cor = "slate", icon, sub }) {
  const cls = {
    slate: "border-slate-200 bg-slate-50 text-slate-900",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-900",
    rose: "border-rose-200 bg-rose-50 text-rose-900",
    amber: "border-amber-200 bg-amber-50 text-amber-900",
    blue: "border-blue-200 bg-blue-50 text-blue-900",
    purple: "border-purple-200 bg-purple-50 text-purple-900",
  }[cor];

  return (
    <div className={`rounded-2xl border ${cls} px-4 py-3`}>
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-bold uppercase tracking-[0.18em] opacity-70">{titulo}</div>
        {icon ? <span className="text-base opacity-60">{icon}</span> : null}
      </div>
      <div className="mt-1 text-2xl font-black">{valor}</div>
      {sub ? <div className="mt-0.5 text-[11px] opacity-70">{sub}</div> : null}
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
      <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">{label}</div>
      <div className="mt-0.5 font-bold text-slate-800">{value || "-"}</div>
    </div>
  );
}

function FuncionarioModal({ funcionario, onClose }) {
  if (!funcionario) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/60 p-4">
      <div className="w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-600">Funcionario</div>
            <div className="mt-0.5 text-xl font-black text-slate-900">{funcionario.nm_funcionario || "-"}</div>
            <div className="text-sm text-slate-500">{funcionario.nm_funcao || "-"}</div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
            <FaTimes />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 px-6 py-5 md:grid-cols-2">
          <Info label="ID" value={funcionario.id_funcionario} />
          <Info label="Chapa" value={funcionario.nr_cracha} />
          <Info label="Telefone" value={funcionario.nr_telefone_celular} />
          <Info label="Status" value={funcionario.status || "Ativo"} />
          <Info
            label="Afastamento"
            value={
              funcionario._afastado
                ? `${funcionario._afastamento?.motivo || "Afastado"}${
                    funcionario._afastamento?.data_inicio
                      ? ` - desde ${formatDateBR(funcionario._afastamento.data_inicio)}`
                      : ""
                  }`
                : "Ativo"
            }
          />
          <Info label="Admissao" value={formatDateBR(funcionario.dt_inicio_atividade)} />
          <Info label="Tempo de empresa" value={calcTempoEmpresa(funcionario.dt_inicio_atividade) || "-"} />
          <div className="md:col-span-2">
            <Info
              label="Alocacao no organograma"
              value={funcionario._alocacao === "Alocado" ? `Alocado em ${funcionario._area_titulo || "-"}` : "Sobrando"}
            />
          </div>
        </div>

        <div className="flex justify-end border-t border-slate-200 bg-slate-50 px-6 py-3">
          <button
            onClick={onClose}
            className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
            type="button"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

function AfastamentoModal({ funcionario, open, saving, onClose, onSave, onEncerrar }) {
  const [motivo, setMotivo] = useState("");
  const [observacao, setObservacao] = useState("");
  const [dataInicio, setDataInicio] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    if (!open || !funcionario) return;
    setMotivo(funcionario._afastamento?.motivo || "");
    setObservacao(funcionario._afastamento?.observacao || "");
    setDataInicio(funcionario._afastamento?.data_inicio || new Date().toISOString().slice(0, 10));
  }, [funcionario, open]);

  if (!open || !funcionario) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/60 p-4">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber-600">Afastamento</div>
            <div className="mt-0.5 text-xl font-black text-slate-900">{funcionario.nm_funcionario || "-"}</div>
            <div className="text-sm text-slate-500">{funcionario.nm_funcao || "-"}</div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
            <FaTimes />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          {funcionario._afastado ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Colaborador afastado atualmente por <strong>{funcionario._afastamento?.motivo || "motivo nao informado"}</strong>.
            </div>
          ) : null}

          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Motivo</span>
            <input
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex.: atestado, INSS, licenca..."
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-amber-400 focus:outline-none"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Data inicio</span>
            <input
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-amber-400 focus:outline-none"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Observacao</span>
            <textarea
              rows={3}
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Detalhes opcionais..."
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-amber-400 focus:outline-none"
            />
          </label>
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4 sm:flex-row sm:justify-between">
          <div>
            {funcionario._afastado ? (
              <button
                type="button"
                onClick={onEncerrar}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                <FaCheckCircle /> Encerrar afastamento
              </button>
            ) : null}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              onClick={onClose}
              className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
              type="button"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={saving || !String(motivo || "").trim()}
              onClick={() => onSave({ motivo, observacao, dataInicio })}
              className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-bold text-white hover:bg-amber-700 disabled:opacity-60"
            >
              <FaUserTimes /> {saving ? "Salvando..." : funcionario._afastado ? "Atualizar afastamento" : "Marcar afastado"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Funcionarios() {
  const { user } = useContext(AuthContext);
  const [funcionarios, setFuncionarios] = useState([]);
  const [pessoasOrg, setPessoasOrg] = useState([]);
  const [areasOrg, setAreasOrg] = useState([]);
  const [afastados, setAfastados] = useState([]);
  const [loading, setLoading] = useState(false);
  const [savingAfastamento, setSavingAfastamento] = useState(false);
  const [busca, setBusca] = useState("");
  const [funcaoFiltro, setFuncaoFiltro] = useState("");
  const [tab, setTab] = useState("todos");
  const [selecionado, setSelecionado] = useState(null);
  const [afastamentoTarget, setAfastamentoTarget] = useState(null);
  const navigate = useNavigate();

  async function carregar() {
    setLoading(true);
    const pageSize = 1000;
    let start = 0;
    let all = [];

    try {
      while (true) {
        const { data, error } = await supabaseBCNT
          .from("funcionarios_atualizada")
          .select("id_funcionario, nr_cracha, nm_funcionario, nm_funcao, nr_telefone_celular, dt_inicio_atividade, status")
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

      setFuncionarios(all);
    } catch (error) {
      console.error(error);
      setFuncionarios([]);
    }

    const [pessoasResp, areasResp, afastadosResp] = await Promise.all([
      supabase
        .from("organograma_manutencao_pessoas")
        .select("funcionario_id, funcionario_cracha, nome, area_codigo, tipo_headcount, ativo")
        .eq("ativo", true)
        .eq("tipo_headcount", "REALIZADO"),
      supabase.from("organograma_manutencao_areas").select("codigo, titulo").eq("ativo", true),
      supabase.from("afastados").select("*").eq("ativo", true).order("data_inicio", { ascending: false }),
    ]);

    setPessoasOrg(pessoasResp.error ? [] : pessoasResp.data || []);
    setAreasOrg(areasResp.error ? [] : areasResp.data || []);
    setAfastados(afastadosResp.error ? [] : afastadosResp.data || []);
    setLoading(false);
  }

  useEffect(() => {
    carregar();
  }, []);

  const areasByCodigo = useMemo(() => new Map(areasOrg.map((a) => [a.codigo, a])), [areasOrg]);

  const alocPorChave = useMemo(() => {
    const map = new Map();
    for (const pessoa of pessoasOrg) {
      const key = String(pessoa.funcionario_id || pessoa.funcionario_cracha || normalizeText(pessoa.nome) || "");
      if (key) map.set(key, pessoa);
    }
    return map;
  }, [pessoasOrg]);

  const afastamentoPorChave = useMemo(() => {
    const map = new Map();
    for (const item of afastados) {
      const key = buildFuncionarioKey(item);
      if (key) map.set(key, item);
    }
    return map;
  }, [afastados]);

  const enriquecidos = useMemo(() => {
    return funcionarios.map((funcionario) => {
      const key = buildFuncionarioKey(funcionario);
      const aloc = alocPorChave.get(key);
      const afastamento = afastamentoPorChave.get(key);
      const areaTitulo = aloc ? areasByCodigo.get(aloc.area_codigo)?.titulo : "";

      return {
        ...funcionario,
        _alocacao: aloc ? "Alocado" : "Sobrando",
        _area_codigo: aloc?.area_codigo || "",
        _area_titulo: areaTitulo || "",
        _afastamento: afastamento || null,
        _afastado: Boolean(afastamento),
      };
    });
  }, [funcionarios, alocPorChave, areasByCodigo, afastamentoPorChave]);

  const funcoesOptions = useMemo(() => {
    const set = new Set();
    for (const funcionario of funcionarios) {
      const funcao = String(funcionario.nm_funcao || "").trim();
      if (funcao) set.add(funcao);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [funcionarios]);

  const filtrados = useMemo(() => {
    const q = normalizeText(busca);

    return enriquecidos.filter((funcionario) => {
      if (funcaoFiltro && funcionario.nm_funcao !== funcaoFiltro) return false;
      if (tab === "alocados" && funcionario._alocacao !== "Alocado") return false;
      if (tab === "sobra" && funcionario._alocacao !== "Sobrando") return false;
      if (tab === "afastados" && !funcionario._afastado) return false;
      if (tab === "ativos" && funcionario._afastado) return false;
      if (!q) return true;

      const blob = normalizeText(
        `${funcionario.nm_funcionario} ${funcionario.nr_cracha} ${funcionario.nm_funcao} ${funcionario.nr_telefone_celular} ${funcionario._area_titulo} ${funcionario._afastamento?.motivo || ""}`
      );
      return blob.includes(q);
    });
  }, [enriquecidos, busca, funcaoFiltro, tab]);

  const stats = useMemo(() => {
    const total = enriquecidos.length;
    const alocados = enriquecidos.filter((funcionario) => funcionario._alocacao === "Alocado").length;
    const sobra = total - alocados;
    const comCracha = funcionarios.filter((funcionario) => String(funcionario.nr_cracha || "").trim()).length;
    const afastadosCount = enriquecidos.filter((funcionario) => funcionario._afastado).length;

    return {
      total,
      alocados,
      sobra,
      comCracha,
      afastadosCount,
      ativosCount: total - afastadosCount,
    };
  }, [enriquecidos, funcionarios]);

  async function salvarAfastamento({ motivo, observacao, dataInicio }) {
    if (!afastamentoTarget) return;

    setSavingAfastamento(true);
    try {
      const payload = {
        funcionario_id: afastamentoTarget.id_funcionario || null,
        funcionario_cracha: afastamentoTarget.nr_cracha || null,
        nome: afastamentoTarget.nm_funcionario || null,
        funcao: afastamentoTarget.nm_funcao || null,
        motivo: String(motivo || "").trim(),
        observacao: String(observacao || "").trim() || null,
        data_inicio: dataInicio || new Date().toISOString().slice(0, 10),
        ativo: true,
        criado_por_login: user?.login || null,
        criado_por_nome: user?.nome || null,
        atualizado_por_login: user?.login || null,
        atualizado_por_nome: user?.nome || null,
        atualizado_em: new Date().toISOString(),
      };

      if (afastamentoTarget._afastamento?.id) {
        const { error } = await supabase.from("afastados").update(payload).eq("id", afastamentoTarget._afastamento.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("afastados").insert(payload);
        if (error) throw error;
      }

      setAfastamentoTarget(null);
      await carregar();
    } catch (error) {
      console.error(error);
      alert(`Falha ao salvar afastamento: ${error.message || error}`);
    } finally {
      setSavingAfastamento(false);
    }
  }

  async function encerrarAfastamento() {
    if (!afastamentoTarget?._afastamento?.id) return;

    setSavingAfastamento(true);
    try {
      const { error } = await supabase
        .from("afastados")
        .update({
          ativo: false,
          data_fim: new Date().toISOString().slice(0, 10),
          atualizado_por_login: user?.login || null,
          atualizado_por_nome: user?.nome || null,
          atualizado_em: new Date().toISOString(),
        })
        .eq("id", afastamentoTarget._afastamento.id);

      if (error) throw error;
      setAfastamentoTarget(null);
      await carregar();
    } catch (error) {
      console.error(error);
      alert(`Falha ao encerrar afastamento: ${error.message || error}`);
    } finally {
      setSavingAfastamento(false);
    }
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-blue-600">Pessoas - Quadro</div>
          <h1 className="text-2xl font-black text-slate-900 md:text-3xl">Funcionarios</h1>
          <p className="text-sm text-slate-500">
            Base ativa cruzada com o organograma. Quem nao esta alocado em nenhuma area aparece como "Sobrando".
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => navigate("/organograma")}
            className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm font-bold text-blue-700 shadow-sm hover:bg-blue-50"
          >
            <FaSitemap /> Organograma
          </button>
          <button
            type="button"
            onClick={() => exportarCSV(filtrados, "funcionarios")}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-bold text-white shadow hover:bg-emerald-700"
          >
            <FaDownload /> Exportar CSV
          </button>
          <button
            type="button"
            onClick={carregar}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-sm font-bold text-white shadow hover:bg-slate-800 disabled:opacity-60"
          >
            <FaSync className={loading ? "animate-spin" : ""} /> {loading ? "Atualizando..." : "Atualizar"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <CardKPI titulo="Funcionarios" valor={fmtInt(stats.total)} cor="slate" icon={<FaUsers />} sub="Ativos na base BCNT" />
        <CardKPI titulo="Alocados" valor={fmtInt(stats.alocados)} cor="emerald" icon={<FaSitemap />} sub="Dentro do organograma" />
        <CardKPI titulo="Sobrando" valor={fmtInt(stats.sobra)} cor="rose" icon={<FaUsers />} sub="Fora do organograma" />
        <CardKPI titulo="Com chapa" valor={fmtInt(stats.comCracha)} cor="blue" icon={<FaIdBadge />} sub="Possuem identificacao" />
        <CardKPI titulo="Afastados" valor={fmtInt(stats.afastadosCount)} cor="amber" icon={<FaUserTimes />} sub="Marcados manualmente" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setTab("todos")}
          className={`rounded-xl border px-3 py-2 text-sm font-bold transition ${
            tab === "todos" ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
          }`}
        >
          Todos ({stats.total})
        </button>
        <button
          type="button"
          onClick={() => setTab("alocados")}
          className={`rounded-xl border px-3 py-2 text-sm font-bold transition ${
            tab === "alocados" ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
          }`}
        >
          Alocados ({stats.alocados})
        </button>
        <button
          type="button"
          onClick={() => setTab("sobra")}
          className={`rounded-xl border px-3 py-2 text-sm font-bold transition ${
            tab === "sobra" ? "border-rose-600 bg-rose-600 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
          }`}
        >
          Sobrando ({stats.sobra})
        </button>
        <button
          type="button"
          onClick={() => setTab("ativos")}
          className={`rounded-xl border px-3 py-2 text-sm font-bold transition ${
            tab === "ativos" ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
          }`}
        >
          Sem afastamento ({stats.ativosCount})
        </button>
        <button
          type="button"
          onClick={() => setTab("afastados")}
          className={`rounded-xl border px-3 py-2 text-sm font-bold transition ${
            tab === "afastados" ? "border-amber-600 bg-amber-600 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
          }`}
        >
          Afastados ({stats.afastadosCount})
        </button>

        <div className="ml-auto flex flex-wrap gap-2">
          <select
            value={funcaoFiltro}
            onChange={(e) => setFuncaoFiltro(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm focus:border-blue-400 focus:outline-none"
          >
            <option value="">Todas as funcoes</option>
            {funcoesOptions.map((funcao) => (
              <option key={funcao} value={funcao}>
                {funcao}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="relative">
          <FaSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome, chapa, funcao, telefone, area ou motivo..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-700 focus:border-blue-400 focus:outline-none"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="px-6 py-12 text-center text-slate-500">Carregando funcionarios...</div>
        ) : filtrados.length === 0 ? (
          <div className="px-6 py-12 text-center text-slate-500">Nenhum funcionario encontrado.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtrados.map((funcionario) => (
              <button
                key={`${funcionario.id_funcionario || funcionario.nr_cracha || funcionario.nm_funcionario}`}
                type="button"
                onClick={() => setSelecionado(funcionario)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-slate-50"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold text-slate-900">{funcionario.nm_funcionario}</div>
                  <div className="truncate text-[11px] text-slate-500">
                    {funcionario.nm_funcao || "-"}
                    {funcionario.nr_cracha ? ` - Chapa ${funcionario.nr_cracha}` : ""}
                    {funcionario.nr_telefone_celular ? ` - ${funcionario.nr_telefone_celular}` : ""}
                    {funcionario._afastado ? ` - Afastado: ${funcionario._afastamento?.motivo || "Motivo nao informado"}` : ""}
                  </div>
                </div>

                <div className="flex flex-shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setAfastamentoTarget(funcionario);
                    }}
                    className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-700 hover:bg-slate-200"
                  >
                    {funcionario._afastado ? "Editar afast." : "Afastar"}
                  </button>

                  <span className="hidden text-[11px] text-slate-500 md:inline">{calcTempoEmpresa(funcionario.dt_inicio_atividade)}</span>

                  {funcionario._afastado ? (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">
                      Afastado
                    </span>
                  ) : null}

                  {funcionario._alocacao === "Alocado" ? (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                      {funcionario._area_titulo || "Alocado"}
                    </span>
                  ) : (
                    <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-rose-700">
                      Sobrando
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <FuncionarioModal funcionario={selecionado} onClose={() => setSelecionado(null)} />
      <AfastamentoModal
        funcionario={afastamentoTarget}
        open={!!afastamentoTarget}
        saving={savingAfastamento}
        onClose={() => setAfastamentoTarget(null)}
        onSave={salvarAfastamento}
        onEncerrar={encerrarAfastamento}
      />
    </div>
  );
}
