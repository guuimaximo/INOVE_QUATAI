import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  FaBriefcase,
  FaCalendarAlt,
  FaDownload,
  FaFilter,
  FaIdBadge,
  FaPhoneAlt,
  FaSearch,
  FaSitemap,
  FaSync,
  FaTimes,
  FaUsers,
} from "react-icons/fa";
import { supabaseBCNT } from "../../supabaseBCNT";
import OrganogramaManutencao from "./OrganogramaManutencao";

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
    alert("Nao ha dados para exportar.");
    return;
  }

  const cabecalho = [
    "ID Funcionario",
    "Cracha",
    "Nome",
    "Funcao",
    "Telefone",
    "Inicio Atividade",
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
      <div className="flex h-full items-start justify-between gap-3">
        <div className="flex h-full flex-col justify-between">
          <p className="text-xs font-black uppercase tracking-wider opacity-80">{title}</p>
          <div>
            <p className="mt-2 text-xl font-black text-slate-800 md:text-3xl">{value}</p>
            {sub ? <p className="mt-1 text-[11px] font-bold opacity-80">{sub}</p> : null}
          </div>
        </div>
        <div className="mt-1 text-xl opacity-80">{icon}</div>
      </div>
    </div>
  );
}

function FuncionarioModal({ funcionario, onClose }) {
  if (!funcionario) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b bg-slate-50 px-5 py-4">
          <div>
            <h2 className="text-lg font-black text-slate-800">Detalhes do funcionario</h2>
            <p className="text-xs font-semibold text-slate-500">Consulta rapida da base BCNT</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
            type="button"
          >
            <FaTimes />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 p-5 text-sm md:grid-cols-2">
          <div className="rounded-xl border bg-slate-50 p-4 md:col-span-2">
            <p className="text-[10px] font-black uppercase text-slate-500">Nome</p>
            <p className="text-lg font-black text-slate-800">{funcionario.nm_funcionario || "-"}</p>
          </div>
          <Info label="ID" value={funcionario.id_funcionario} />
          <Info label="Cracha" value={funcionario.nr_cracha} />
          <Info label="Funcao" value={funcionario.nm_funcao} />
          <Info label="Telefone" value={funcionario.nr_telefone_celular} />
          <Info label="Inicio atividade" value={formatDateBR(funcionario.dt_inicio_atividade)} />
          <Info label="Status" value={funcionario.status || "Ativo"} />
        </div>

        <div className="flex justify-end border-t bg-white px-5 py-3">
          <button
            onClick={onClose}
            className="rounded-xl bg-slate-800 px-5 py-2.5 font-bold text-white transition hover:bg-slate-700"
            type="button"
          >
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
      <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1 font-bold text-slate-800">{value || "-"}</p>
    </div>
  );
}

function PessoasWorkspaceModal({ onClose }) {
  return (
    <div className="fixed inset-0 z-[75] flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-sm md:p-5">
      <div className="flex h-[94vh] w-full max-w-[96vw] flex-col overflow-hidden rounded-[32px] bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b bg-slate-50 px-5 py-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-blue-700">
              <FaUsers /> Modal de Pessoas
            </div>
            <h2 className="mt-3 text-xl font-black text-slate-800">Central visual de pessoas</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              O organograma agora vive aqui dentro, com zoom, ajuste de tela e modal por equipe.
            </p>
          </div>

          <button
            onClick={onClose}
            className="rounded-2xl p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
            type="button"
          >
            <FaTimes />
          </button>
        </div>

        <div className="flex-1 overflow-auto bg-slate-100 p-3 md:p-5">
          <OrganogramaManutencao embedded />
        </div>
      </div>
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
  const [modalPessoasAberto, setModalPessoasAberto] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  function abrirModalPessoas() {
    setModalPessoasAberto(true);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("modal", "pessoas");
    setSearchParams(nextParams, { replace: true });
  }

  function fecharModalPessoas() {
    setModalPessoasAberto(false);
    const nextParams = new URLSearchParams(searchParams);
    if (nextParams.get("modal") === "pessoas") {
      nextParams.delete("modal");
      setSearchParams(nextParams, { replace: true });
    }
  }

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

  useEffect(() => {
    if (searchParams.get("modal") === "pessoas") {
      setModalPessoasAberto(true);
    }
  }, [searchParams]);

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
    <div className="min-h-screen space-y-5 bg-slate-50 p-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">
              <FaUsers /> Base BCNT
            </div>
            <h1 className="mt-3 text-2xl font-black text-slate-800">Central de pessoas</h1>
            <p className="mt-1 flex items-center gap-2 text-sm font-semibold text-slate-500">
              <FaBriefcase /> Consulta da base ativa de funcionarios e acesso ao organograma dinamico do INOVE.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={abrirModalPessoas}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 font-bold text-white shadow-sm transition hover:bg-blue-500"
              type="button"
            >
              <FaSitemap /> Abrir Modal de Pessoas
            </button>
            <button
              onClick={() => exportarCSV(filtrados, "Funcionarios_ativos")}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 font-bold text-white shadow-sm transition hover:bg-emerald-500"
              type="button"
            >
              <FaDownload /> Exportar Dados
            </button>
            <button
              onClick={carregarFuncionarios}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-800 px-4 py-2 font-black text-white transition hover:bg-slate-700 disabled:opacity-70"
              type="button"
            >
              <FaSync className={loading ? "animate-spin" : ""} /> {loading ? "Atualizando..." : "Atualizar"}
            </button>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 items-end gap-4 border-t pt-5 md:grid-cols-3">
          <div className="md:col-span-2">
            <label className="mb-1 block text-[10px] font-black uppercase text-slate-500">Busca</label>
            <div className="relative">
              <FaSearch className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por nome, cracha, funcao ou telefone..."
                value={busca}
                onChange={(event) => setBusca(event.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-11 pr-4 text-sm font-bold text-slate-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[10px] font-black uppercase text-slate-500">Funcao</label>
            <select
              value={funcaoFiltro}
              onChange={(event) => setFuncaoFiltro(event.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
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

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              setBusca("");
              setFuncaoFiltro("");
            }}
            className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-200"
            type="button"
          >
            Limpar filtros
          </button>
          <span className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700">
            <FaFilter /> {fmtInt(filtrados.length)} registro(s)
          </span>
        </div>

        {feedback ? (
          <div
            className={`mt-4 rounded-xl px-4 py-3 text-sm font-bold ${
              feedback.type === "success"
                ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border border-rose-200 bg-rose-50 text-rose-700"
            }`}
          >
            {feedback.text}
          </div>
        ) : null}
      </div>

      <div className="rounded-3xl bg-gradient-to-r from-slate-900 via-blue-900 to-slate-800 p-5 text-white shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-blue-100">
              <FaSitemap /> Organograma interativo
            </div>
            <h2 className="mt-3 text-2xl font-black">Modal de Pessoas com todas as funcionalidades</h2>
            <p className="mt-2 text-sm font-semibold text-blue-100/90">
              Abra o organograma sem sair da central de pessoas, aumente, diminua, ajuste na tela e entre em cada equipe para ver orcado, realizado e registros.
            </p>
          </div>

          <button
            type="button"
            onClick={abrirModalPessoas}
            className="rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-900 transition hover:bg-blue-50"
          >
            Entrar no organograma
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <CardKPI title="Ativos" value={fmtInt(metricas.total)} sub="Funcionarios ativos encontrados" icon={<FaUsers />} tone="slate" />
        <CardKPI title="Com cracha" value={fmtInt(metricas.comCracha)} sub="Registros com identificacao" icon={<FaIdBadge />} tone="blue" />
        <CardKPI title="Com telefone" value={fmtInt(metricas.comTelefone)} sub="Contatos disponiveis" icon={<FaPhoneAlt />} tone="emerald" />
        <CardKPI title="Funcoes" value={fmtInt(metricas.funcoes)} sub="Cargos ativos distintos" icon={<FaBriefcase />} tone="amber" />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-black text-slate-800">Base de funcionarios</h3>
            <p className="text-xs font-semibold text-slate-500">Clique em uma linha para consultar os detalhes.</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[1000px] w-full border-collapse text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="p-3 font-black">Funcionario</th>
                <th className="p-3 font-black">Cracha</th>
                <th className="p-3 font-black">Funcao</th>
                <th className="p-3 font-black">Telefone</th>
                <th className="p-3 font-black">Inicio atividade</th>
                <th className="p-3 font-black">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center font-bold text-slate-400">
                    Atualizando base de funcionarios...
                  </td>
                </tr>
              ) : filtrados.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center font-bold text-slate-400">
                    Nenhum funcionario encontrado para o filtro aplicado.
                  </td>
                </tr>
              ) : (
                filtrados.map((funcionario) => (
                  <tr
                    key={`${funcionario.id_funcionario}-${funcionario.nr_cracha || funcionario.nm_funcionario}`}
                    onClick={() => setSelecionado(funcionario)}
                    className="cursor-pointer border-b border-slate-100 transition-colors hover:bg-blue-50/50 last:border-0"
                  >
                    <td className="p-3">
                      <p className="font-black text-slate-800">{funcionario?.nm_funcionario || "Sem nome"}</p>
                      <p className="text-xs font-semibold text-slate-500">ID {funcionario?.id_funcionario || "-"}</p>
                    </td>
                    <td className="p-3">
                      <span className="rounded-lg border border-slate-200 bg-slate-100 px-2.5 py-1 text-[11px] font-black text-slate-600">
                        {funcionario?.nr_cracha || "-"}
                      </span>
                    </td>
                    <td className="p-3 font-bold text-slate-700">{funcionario?.nm_funcao || "-"}</td>
                    <td className="p-3 font-bold text-slate-700">{funcionario?.nr_telefone_celular || "-"}</td>
                    <td className="p-3 font-bold text-slate-700">
                      <FaCalendarAlt className="mr-1 inline text-slate-400" />
                      {formatDateBR(funcionario?.dt_inicio_atividade)}
                    </td>
                    <td className="p-3">
                      <span className="inline-flex rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-black text-emerald-700">
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

      {loading ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/20 backdrop-blur-[1px]">
          <div className="rounded-2xl border border-slate-200 bg-white px-6 py-4 font-black text-slate-800 shadow-xl">
            Carregando funcionarios...
          </div>
        </div>
      ) : null}

      {selecionado ? <FuncionarioModal funcionario={selecionado} onClose={() => setSelecionado(null)} /> : null}
      {modalPessoasAberto ? <PessoasWorkspaceModal onClose={fecharModalPessoas} /> : null}
    </div>
  );
}
