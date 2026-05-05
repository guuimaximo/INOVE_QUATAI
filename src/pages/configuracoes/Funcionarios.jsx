import { useEffect, useMemo, useState } from "react";
import {
  FaBriefcase,
  FaCalendarAlt,
  FaDownload,
  FaFilter,
  FaIdBadge,
  FaPhoneAlt,
  FaSearch,
  FaSync,
  FaUsers,
  FaTimes,
} from "react-icons/fa";
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

function fmtInt(v) {
  return Math.round(Number(v || 0)).toLocaleString("pt-BR");
}

function exportarCSV(dados, nomeArquivo) {
  if (!dados?.length) {
    alert("Não há dados para exportar.");
    return;
  }

  const cabecalho = [
    "ID Funcionário",
    "Crachá",
    "Nome",
    "Função",
    "Telefone",
    "Início Atividade",
    "Status",
  ];

  const linhas = dados.map((row) =>
    [
      row.id_funcionario || "",
      row.nr_cracha || "",
      row.nm_funcionario || "",
      row.nm_funcao || "",
      row.nr_telefone_celular || "",
      formatDateBR(row.dt_inicio_atividade),
      row.status || "",
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(";")
  );

  const csv = [cabecalho.join(";"), ...linhas].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${nomeArquivo}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function buildSearchBlob(funcionario) {
  return [
    funcionario?.nm_funcionario,
    funcionario?.nr_cracha,
    funcionario?.nm_funcao,
    funcionario?.nr_telefone_celular,
    funcionario?.status,
  ]
    .map((item) => normalizeText(item))
    .join(" ");
}

function CardKPI({ title, value, sub, icon, tone = "blue" }) {
  const tones = {
    blue: "from-blue-50 to-cyan-50 border-blue-200 text-blue-700",
    emerald: "from-emerald-50 to-teal-50 border-emerald-200 text-emerald-700",
    amber: "from-amber-50 to-orange-50 border-amber-200 text-amber-700",
    rose: "from-rose-50 to-pink-50 border-rose-200 text-rose-700",
    violet: "from-violet-50 to-fuchsia-50 border-violet-200 text-violet-700",
    slate: "from-slate-50 to-gray-50 border-slate-200 text-slate-700",
  };

  return (
    <div className={`rounded-2xl border bg-gradient-to-br ${tones[tone]} p-3.5 shadow-sm`}>
      <div className="flex items-start justify-between gap-3 h-full">
        <div className="flex flex-col justify-between h-full">
          <p className="text-xs font-black uppercase tracking-wider opacity-80">{title}</p>
          <div>
            <p className="text-xl md:text-3xl font-black mt-2 text-slate-800">{value}</p>
            {sub && <p className="text-[11px] mt-1 font-bold opacity-80">{sub}</p>}
          </div>
        </div>
        <div className="text-xl mt-1 opacity-80">{icon}</div>
      </div>
    </div>
  );
}

function FuncionarioModal({ funcionario, onClose }) {
  if (!funcionario) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">
        <div className="px-5 py-4 border-b bg-slate-50 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black text-slate-800">Detalhes do funcionário</h2>
            <p className="text-xs text-slate-500 font-semibold">Consulta rápida da base BCNT</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition">
            <FaTimes />
          </button>
        </div>

        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="md:col-span-2 rounded-xl border bg-slate-50 p-4">
            <p className="text-[10px] font-black text-slate-500 uppercase">Nome</p>
            <p className="font-black text-slate-800 text-lg">{funcionario.nm_funcionario || "-"}</p>
          </div>
          <Info label="ID" value={funcionario.id_funcionario} />
          <Info label="Crachá" value={funcionario.nr_cracha} />
          <Info label="Função" value={funcionario.nm_funcao} />
          <Info label="Telefone" value={funcionario.nr_telefone_celular} />
          <Info label="Início atividade" value={formatDateBR(funcionario.dt_inicio_atividade)} />
          <Info label="Status" value={funcionario.status || "Ativo"} />
        </div>

        <div className="px-5 py-3 border-t bg-white flex justify-end">
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl bg-slate-800 text-white font-bold hover:bg-slate-700 transition">
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider">{label}</p>
      <p className="mt-1 font-bold text-slate-800">{value || "-"}</p>
    </div>
  );
}

export default function Funcionarios() {
  const [funcionarios, setFuncionarios] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busca, setBusca] = useState("");
  const [funcaoFiltro, setFuncaoFiltro] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [selecionado, setSelecionado] = useState(null);

  async function carregarFuncionarios() {
    setLoading(true);
    setFeedback(null);

    const pageSize = 1000;
    let start = 0;
    let all = [];

    try {
      while (true) {
        const end = start + pageSize - 1;
        const { data, error } = await supabaseBCNT
          .from("funcionarios_atualizada")
          .select(
            "id_funcionario, nr_cracha, nm_funcionario, nm_funcao, nr_telefone_celular, dt_inicio_atividade, status"
          )
          .eq("status", "ativo")
          .order("nm_funcionario", { ascending: true })
          .range(start, end);

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
      setFeedback({
        type: "error",
        text: "Nao foi possivel carregar a central de funcionarios ativos.",
      });
      setFuncionarios([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregarFuncionarios();
  }, []);

  const funcoesOptions = useMemo(() => {
    return [
      ...new Set(
        funcionarios
          .map((funcionario) => String(funcionario?.nm_funcao || "").trim())
          .filter(Boolean)
      ),
    ].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [funcionarios]);

  const filtrados = useMemo(() => {
    const term = normalizeText(busca);

    return funcionarios.filter((funcionario) => {
      if (term && !buildSearchBlob(funcionario).includes(term)) return false;
      if (funcaoFiltro && funcionario?.nm_funcao !== funcaoFiltro) return false;
      return true;
    });
  }, [funcionarios, busca, funcaoFiltro]);

  const metricas = useMemo(() => {
    const total = funcionarios.length;
    const comCracha = funcionarios.filter((funcionario) => String(funcionario?.nr_cracha || "").trim()).length;
    const comTelefone = funcionarios.filter((funcionario) => String(funcionario?.nr_telefone_celular || "").trim()).length;
    const funcoes = funcoesOptions.length;

    return { total, comCracha, comTelefone, funcoes };
  }, [funcionarios, funcoesOptions]);

  return (
    <div className="min-h-screen bg-slate-50 p-4 space-y-5">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 md:p-5">
        <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-black border border-blue-200">
              <FaUsers /> Base BCNT
            </div>
            <h1 className="mt-3 text-2xl font-black text-slate-800">Central de funcionários</h1>
            <p className="text-sm text-slate-500 mt-1 flex items-center gap-2 font-semibold">
              <FaBriefcase /> Consulta da base ativa de funcionários consumida do Supabase BCNT.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => exportarCSV(filtrados, "Funcionarios_ativos")}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-500 transition shadow-sm"
            >
              <FaDownload /> Exportar Dados
            </button>
            <button
              onClick={carregarFuncionarios}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-800 bg-slate-800 text-white font-black hover:bg-slate-700 transition disabled:opacity-70"
            >
              <FaSync className={loading ? "animate-spin" : ""} /> {loading ? "Atualizando..." : "Atualizar"}
            </button>
          </div>
        </div>

        <div className="mt-5 pt-5 border-t grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div className="md:col-span-2">
            <label className="text-[10px] font-black text-slate-500 uppercase mb-1 block">Busca</label>
            <div className="relative">
              <FaSearch className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por nome, crachá, função ou telefone..."
                value={busca}
                onChange={(event) => setBusca(event.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-11 pr-4 text-sm font-bold text-slate-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase mb-1 block">Função</label>
            <select
              value={funcaoFiltro}
              onChange={(event) => setFuncaoFiltro(event.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
            >
              <option value="">Todas as funções</option>
              {funcoesOptions.map((funcao) => (
                <option key={funcao} value={funcao}>{funcao}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 items-center">
          <button
            onClick={() => {
              setBusca("");
              setFuncaoFiltro("");
            }}
            className="px-4 py-2 rounded-xl font-black text-sm bg-slate-100 text-slate-700 hover:bg-slate-200 transition"
          >
            Limpar filtros
          </button>
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 font-bold text-sm">
            <FaFilter /> {fmtInt(filtrados.length)} registro(s)
          </span>
        </div>

        {feedback && (
          <div className={`mt-4 rounded-xl px-4 py-3 text-sm font-bold ${feedback.type === "success" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-rose-50 text-rose-700 border border-rose-200"}`}>
            {feedback.text}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <CardKPI title="Ativos" value={fmtInt(metricas.total)} sub="Funcionários ativos encontrados" icon={<FaUsers />} tone="slate" />
        <CardKPI title="Com crachá" value={fmtInt(metricas.comCracha)} sub="Registros com identificação" icon={<FaIdBadge />} tone="blue" />
        <CardKPI title="Com telefone" value={fmtInt(metricas.comTelefone)} sub="Contatos disponíveis" icon={<FaPhoneAlt />} tone="emerald" />
        <CardKPI title="Funções" value={fmtInt(metricas.funcoes)} sub="Cargos ativos distintos" icon={<FaBriefcase />} tone="amber" />
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-black text-slate-800">Base de funcionários</h3>
            <p className="text-xs text-slate-500 font-semibold">Clique em uma linha para consultar os detalhes.</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse min-w-[1000px]">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="p-3 font-black">Funcionário</th>
                <th className="p-3 font-black">Crachá</th>
                <th className="p-3 font-black">Função</th>
                <th className="p-3 font-black">Telefone</th>
                <th className="p-3 font-black">Início atividade</th>
                <th className="p-3 font-black">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="p-8 text-center text-slate-400 font-bold">Atualizando base de funcionários...</td></tr>
              ) : filtrados.length === 0 ? (
                <tr><td colSpan={6} className="p-8 text-center text-slate-400 font-bold">Nenhum funcionário encontrado para o filtro aplicado.</td></tr>
              ) : (
                filtrados.map((funcionario) => (
                  <tr
                    key={`${funcionario.id_funcionario}-${funcionario.nr_cracha || funcionario.nm_funcionario}`}
                    onClick={() => setSelecionado(funcionario)}
                    className="border-b border-slate-100 last:border-0 hover:bg-blue-50/50 transition-colors cursor-pointer"
                  >
                    <td className="p-3">
                      <p className="font-black text-slate-800">{funcionario?.nm_funcionario || "Sem nome"}</p>
                      <p className="text-xs text-slate-500 font-semibold">ID {funcionario?.id_funcionario || "-"}</p>
                    </td>
                    <td className="p-3">
                      <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-black text-slate-600 border border-slate-200">
                        {funcionario?.nr_cracha || "-"}
                      </span>
                    </td>
                    <td className="p-3 font-bold text-slate-700">{funcionario?.nm_funcao || "-"}</td>
                    <td className="p-3 font-bold text-slate-700">{funcionario?.nr_telefone_celular || "-"}</td>
                    <td className="p-3 font-bold text-slate-700"><FaCalendarAlt className="inline mr-1 text-slate-400" />{formatDateBR(funcionario?.dt_inicio_atividade)}</td>
                    <td className="p-3">
                      <span className="inline-flex rounded-lg bg-emerald-50 px-2.5 py-1 text-[11px] font-black text-emerald-700 border border-emerald-200">
                        Ativo
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {loading && (
        <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-[1px] flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl px-6 py-4 shadow-xl border border-slate-200 font-black text-slate-800">
            Carregando funcionários...
          </div>
        </div>
      )}

      {selecionado && <FuncionarioModal funcionario={selecionado} onClose={() => setSelecionado(null)} />}
    </div>
  );
}
