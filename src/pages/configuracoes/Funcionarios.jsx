import { useEffect, useMemo, useState } from "react";
import {
  FaBriefcase,
  FaIdBadge,
  FaPhoneAlt,
  FaSearch,
  FaSync,
  FaUsers,
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
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    const raw = String(value);
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      const [year, month, day] = raw.split("-");
      return `${day}/${month}/${year}`;
    }
    return raw;
  }

  return date.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

function StatCard({ title, value, hint, icon, tone }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{title}</p>
          <p className="text-3xl font-black tracking-tight text-slate-900">{value}</p>
          <p className="text-sm text-slate-500">{hint}</p>
        </div>
        <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${tone}`}>{icon}</div>
      </div>
    </div>
  );
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

export default function Funcionarios() {
  const [funcionarios, setFuncionarios] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busca, setBusca] = useState("");
  const [feedback, setFeedback] = useState(null);

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

  const filtrados = useMemo(() => {
    const term = normalizeText(busca);
    if (!term) return funcionarios;
    return funcionarios.filter((funcionario) => buildSearchBlob(funcionario).includes(term));
  }, [funcionarios, busca]);

  const metricas = useMemo(() => {
    const total = funcionarios.length;
    const comCracha = funcionarios.filter((funcionario) => String(funcionario?.nr_cracha || "").trim()).length;
    const comTelefone = funcionarios.filter((funcionario) => String(funcionario?.nr_telefone_celular || "").trim()).length;
    const funcoes = new Set(
      funcionarios
        .map((funcionario) => String(funcionario?.nm_funcao || "").trim())
        .filter(Boolean)
    ).size;

    return { total, comCracha, comTelefone, funcoes };
  }, [funcionarios]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
        <div className="bg-[linear-gradient(135deg,#0f172a_0%,#1d4ed8_45%,#38bdf8_100%)] px-6 py-7 text-white md:px-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl space-y-3">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/12 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-blue-50 ring-1 ring-inset ring-white/15">
                <FaUsers /> Base BCNT
              </span>
              <div>
                <h1 className="text-3xl font-black tracking-tight md:text-4xl">Funcionarios</h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-100 md:text-base">
                  Central de consulta da base ativa de funcionarios consumida do Supabase BCNT.
                </p>
              </div>
            </div>

            <button
              onClick={carregarFuncionarios}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-bold text-slate-900 shadow-lg shadow-slate-950/10 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-70"
            >
              <FaSync className={loading ? "animate-spin" : ""} />
              {loading ? "Atualizando base..." : "Atualizar central"}
            </button>
          </div>
        </div>

        <div className="grid gap-4 border-t border-slate-200 bg-slate-50/80 px-6 py-5 md:grid-cols-2 xl:grid-cols-4 md:px-8">
          <StatCard
            title="Ativos"
            value={metricas.total}
            hint="Funcionarios ativos encontrados"
            icon={<FaUsers className="text-xl text-slate-700" />}
            tone="bg-slate-100 text-slate-700"
          />
          <StatCard
            title="Com cracha"
            value={metricas.comCracha}
            hint="Registros com identificacao preenchida"
            icon={<FaIdBadge className="text-xl text-blue-700" />}
            tone="bg-blue-100 text-blue-700"
          />
          <StatCard
            title="Com telefone"
            value={metricas.comTelefone}
            hint="Contatos disponíveis na base"
            icon={<FaPhoneAlt className="text-xl text-emerald-700" />}
            tone="bg-emerald-100 text-emerald-700"
          />
          <StatCard
            title="Funcoes"
            value={metricas.funcoes}
            hint="Cargos ativos distintos"
            icon={<FaBriefcase className="text-xl text-amber-700" />}
            tone="bg-amber-100 text-amber-700"
          />
        </div>
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-5 md:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-slate-900">Central de funcionarios</h2>
              <p className="text-sm text-slate-500">
                Consulta direta da tabela nova, trazendo apenas registros com status ativo.
              </p>
            </div>

            <div className="relative w-full max-w-xl">
              <FaSearch className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por nome, cracha, funcao ou telefone..."
                value={busca}
                onChange={(event) => setBusca(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
              />
            </div>
          </div>

          {feedback && (
            <div
              className={`mt-4 rounded-2xl px-4 py-3 text-sm font-medium ${
                feedback.type === "success"
                  ? "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200"
                  : "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200"
              }`}
            >
              {feedback.text}
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr className="text-left text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                <th className="px-6 py-4 md:px-8">Funcionario</th>
                <th className="px-6 py-4">Cracha</th>
                <th className="px-6 py-4">Funcao</th>
                <th className="px-6 py-4">Telefone</th>
                <th className="px-6 py-4">Inicio atividade</th>
                <th className="px-6 py-4 md:px-8">Status</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 bg-white">
              {loading ? (
                <tr>
                  <td colSpan="6" className="px-6 py-10 text-center text-sm font-medium text-slate-500 md:px-8">
                    Atualizando base de funcionarios...
                  </td>
                </tr>
              ) : filtrados.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-10 text-center text-sm font-medium text-slate-500 md:px-8">
                    Nenhum funcionario ativo encontrado para o filtro aplicado.
                  </td>
                </tr>
              ) : (
                filtrados.map((funcionario) => (
                  <tr key={`${funcionario.id_funcionario}-${funcionario.nr_cracha || funcionario.nm_funcionario}`} className="transition hover:bg-slate-50/80">
                    <td className="px-6 py-4 md:px-8">
                      <div className="space-y-1">
                        <p className="font-semibold text-slate-900">{funcionario?.nm_funcionario || "Sem nome"}</p>
                        <p className="text-xs text-slate-500">
                          ID {funcionario?.id_funcionario || "-"}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600 ring-1 ring-inset ring-slate-200">
                        {funcionario?.nr_cracha || "-"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-700">{funcionario?.nm_funcao || "-"}</td>
                    <td className="px-6 py-4 text-slate-700">{funcionario?.nr_telefone_celular || "-"}</td>
                    <td className="px-6 py-4 text-slate-700">{formatDateBR(funcionario?.dt_inicio_atividade)}</td>
                    <td className="px-6 py-4 md:px-8">
                      <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
                        Ativo
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
