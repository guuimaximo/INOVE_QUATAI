import { useEffect, useMemo, useState } from "react";
import {
  FaCheckCircle,
  FaCrown,
  FaSearch,
  FaShieldAlt,
  FaSync,
  FaUserCheck,
  FaUserClock,
  FaUserShield,
  FaUserSlash,
  FaUsers,
} from "react-icons/fa";
import { supabase } from "../../supabase";

const NIVEIS = [
  "Pendente",
  "CCO",
  "Manutenção",
  "Tratativa",
  "Instrutor",
  "Embarcados",
  "RH",
  "Gestor",
  "Administrador",
];

function normalizeText(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function getNivelTone(nivel) {
  const clean = normalizeText(nivel);

  if (clean === "administrador") return "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200";
  if (clean === "gestor") return "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200";
  if (clean === "pendente") return "bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200";
  return "bg-violet-50 text-violet-700 ring-1 ring-inset ring-violet-200";
}

function getStatusTone(isActive) {
  return isActive
    ? "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200"
    : "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200";
}

function buildSearchBlob(usuario) {
  return [
    usuario?.nome,
    usuario?.login,
    usuario?.email,
    usuario?.nivel,
    usuario?.setor,
    usuario?.status_cadastro,
  ]
    .map((item) => normalizeText(item))
    .join(" ");
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

export default function Usuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState(null);
  const [busca, setBusca] = useState("");
  const [feedback, setFeedback] = useState(null);

  async function carregarUsuarios() {
    setLoading(true);
    setFeedback(null);

    const { data, error } = await supabase
      .from("usuarios_aprovadores")
      .select("*")
      .order("id", { ascending: true });

    if (error) {
      console.error(error.message);
      setFeedback({
        type: "error",
        text: "Nao foi possivel carregar a base de usuarios.",
      });
    } else {
      setUsuarios(data || []);
    }

    setLoading(false);
  }

  useEffect(() => {
    carregarUsuarios();
  }, []);

  async function atualizarNivel(id, nivel) {
    setSavingId(id);
    setFeedback(null);

    const { error } = await supabase
      .from("usuarios_aprovadores")
      .update({ nivel })
      .eq("id", id);

    if (error) {
      console.error(error.message);
      setFeedback({
        type: "error",
        text: "Erro ao atualizar o nivel do usuario.",
      });
      setSavingId(null);
      return;
    }

    setUsuarios((prev) => prev.map((usuario) => (usuario.id === id ? { ...usuario, nivel } : usuario)));
    setFeedback({
      type: "success",
      text: `Nivel atualizado com sucesso para ${nivel}.`,
    });
    setSavingId(null);
  }

  async function alternarAtivo(id, atual) {
    const novoStatus = !atual;
    setSavingId(id);
    setFeedback(null);

    const { error } = await supabase
      .from("usuarios_aprovadores")
      .update({ ativo: novoStatus })
      .eq("id", id);

    if (error) {
      console.error(error.message);
      setFeedback({
        type: "error",
        text: "Erro ao atualizar o status do usuario.",
      });
      setSavingId(null);
      return;
    }

    setUsuarios((prev) => prev.map((usuario) => (usuario.id === id ? { ...usuario, ativo: novoStatus } : usuario)));
    setFeedback({
      type: "success",
      text: `Usuario ${novoStatus ? "ativado" : "desativado"} com sucesso.`,
    });
    setSavingId(null);
  }

  const filtrados = useMemo(() => {
    const term = normalizeText(busca);
    if (!term) return usuarios;

    return usuarios.filter((usuario) => buildSearchBlob(usuario).includes(term));
  }, [usuarios, busca]);

  const metricas = useMemo(() => {
    const total = usuarios.length;
    const ativos = usuarios.filter((usuario) => usuario?.ativo).length;
    const pendentes = usuarios.filter(
      (usuario) =>
        normalizeText(usuario?.nivel) === "pendente" ||
        normalizeText(usuario?.status_cadastro) === "pendente"
    ).length;
    const administradores = usuarios.filter(
      (usuario) => normalizeText(usuario?.nivel) === "administrador"
    ).length;

    return { total, ativos, pendentes, administradores };
  }, [usuarios]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
        <div className="bg-[linear-gradient(135deg,#0f172a_0%,#1d4ed8_45%,#38bdf8_100%)] px-6 py-7 text-white md:px-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl space-y-3">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/12 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-blue-50 ring-1 ring-inset ring-white/15">
                <FaShieldAlt /> Governanca de Acesso
              </span>
              <div>
                <h1 className="text-3xl font-black tracking-tight md:text-4xl">Gerenciar Usuarios</h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-100 md:text-base">
                  Controle niveis, status de acesso e consistencia da base interna com uma visao mais limpa
                  para administracao do portal.
                </p>
              </div>
            </div>

            <button
              onClick={carregarUsuarios}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-bold text-slate-900 shadow-lg shadow-slate-950/10 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-70"
            >
              <FaSync className={loading ? "animate-spin" : ""} />
              {loading ? "Atualizando base..." : "Atualizar painel"}
            </button>
          </div>
        </div>

        <div className="grid gap-4 border-t border-slate-200 bg-slate-50/80 px-6 py-5 md:grid-cols-2 xl:grid-cols-4 md:px-8">
          <StatCard
            title="Total"
            value={metricas.total}
            hint="Usuarios carregados na base"
            icon={<FaUsers className="text-xl text-slate-700" />}
            tone="bg-slate-100 text-slate-700"
          />
          <StatCard
            title="Ativos"
            value={metricas.ativos}
            hint="Acessos atualmente liberados"
            icon={<FaUserCheck className="text-xl text-emerald-700" />}
            tone="bg-emerald-100 text-emerald-700"
          />
          <StatCard
            title="Pendentes"
            value={metricas.pendentes}
            hint="Cadastros aguardando tratamento"
            icon={<FaUserClock className="text-xl text-blue-700" />}
            tone="bg-blue-100 text-blue-700"
          />
          <StatCard
            title="Administradores"
            value={metricas.administradores}
            hint="Perfis com controle total"
            icon={<FaCrown className="text-xl text-amber-700" />}
            tone="bg-amber-100 text-amber-700"
          />
        </div>
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-5 md:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-slate-900">Base de usuarios</h2>
              <p className="text-sm text-slate-500">
                Pesquise por nome, login, email, nivel ou setor para localizar rapidamente um acesso.
              </p>
            </div>

            <div className="relative w-full max-w-xl">
              <FaSearch className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por nome, login, email, nivel ou setor..."
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
                <th className="px-6 py-4 md:px-8">Usuario</th>
                <th className="px-6 py-4">Login</th>
                <th className="px-6 py-4">Contato</th>
                <th className="px-6 py-4">Nivel</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right md:px-8">Acoes</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 bg-white">
              {loading ? (
                <tr>
                  <td colSpan="6" className="px-6 py-10 text-center text-sm font-medium text-slate-500 md:px-8">
                    Atualizando base de usuarios...
                  </td>
                </tr>
              ) : filtrados.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-10 text-center text-sm font-medium text-slate-500 md:px-8">
                    Nenhum usuario encontrado para o filtro aplicado.
                  </td>
                </tr>
              ) : (
                filtrados.map((usuario) => {
                  const isSaving = savingId === usuario.id;
                  const statusCadastro = usuario?.status_cadastro || "Aprovado";
                  const setor = usuario?.setor || "Nao informado";

                  return (
                    <tr key={usuario.id} className="transition hover:bg-slate-50/80">
                      <td className="px-6 py-4 md:px-8">
                        <div className="flex min-w-[260px] items-start gap-4">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-100">
                            <FaUsers />
                          </div>

                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-semibold text-slate-900">{usuario?.nome || "Sem nome"}</p>
                              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600 ring-1 ring-inset ring-slate-200">
                                ID {usuario.id}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500">Setor: {setor}</p>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <p className="font-medium text-slate-800">{usuario?.login || "-"}</p>
                          <p className="text-xs text-slate-500">{statusCadastro}</p>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <p className="text-slate-700">{usuario?.email || "Sem e-mail"}</p>
                          <p className="text-xs text-slate-500">
                            {usuario?.migrado_auth ? "Vinculado ao Auth" : "Sem vinculo Auth"}
                          </p>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${getNivelTone(usuario?.nivel)}`}>
                            {usuario?.nivel || "Pendente"}
                          </span>

                          <select
                            value={usuario?.nivel || "Pendente"}
                            disabled={isSaving}
                            onChange={(event) => atualizarNivel(usuario.id, event.target.value)}
                            className="min-w-[160px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {NIVEIS.map((nivel) => (
                              <option key={nivel} value={nivel}>
                                {nivel}
                              </option>
                            ))}
                          </select>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <div className="space-y-2">
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${getStatusTone(!!usuario?.ativo)}`}>
                            {usuario?.ativo ? "Ativo" : "Inativo"}
                          </span>

                          <div className="text-xs text-slate-500">{usuario?.ativo ? "Acesso liberado" : "Acesso bloqueado"}</div>
                        </div>
                      </td>

                      <td className="px-6 py-4 md:px-8">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => alternarAtivo(usuario.id, usuario?.ativo)}
                            disabled={isSaving}
                            className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60 ${
                              usuario?.ativo ? "bg-rose-500 hover:bg-rose-600" : "bg-emerald-600 hover:bg-emerald-700"
                            }`}
                          >
                            {usuario?.ativo ? <FaUserSlash /> : <FaCheckCircle />}
                            {usuario?.ativo ? "Desativar" : "Ativar"}
                          </button>

                          <button
                            onClick={() => atualizarNivel(usuario.id, "Administrador")}
                            disabled={isSaving}
                            className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <FaUserShield />
                            Tornar admin
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
