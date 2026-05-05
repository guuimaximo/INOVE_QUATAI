import { useEffect, useMemo, useState } from "react";
import {
  FaBan,
  FaCheckCircle,
  FaCrown,
  FaDownload,
  FaFilter,
  FaInfoCircle,
  FaSearch,
  FaShieldAlt,
  FaSync,
  FaTimes,
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
  "Borracheiro",
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

function fmtInt(v) {
  return Math.round(Number(v || 0)).toLocaleString("pt-BR");
}

function getNivelTone(nivel) {
  const clean = normalizeText(nivel);

  if (clean === "administrador") return "bg-amber-50 text-amber-700 border-amber-200";
  if (clean === "gestor") return "bg-blue-50 text-blue-700 border-blue-200";
  if (clean === "pendente") return "bg-slate-100 text-slate-700 border-slate-200";
  return "bg-violet-50 text-violet-700 border-violet-200";
}

function getStatusTone(isActive) {
  return isActive
    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
    : "bg-rose-50 text-rose-700 border-rose-200";
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

function exportarCSV(dados, nomeArquivo) {
  if (!dados?.length) {
    alert("Não há dados para exportar.");
    return;
  }

  const cabecalho = ["ID", "Nome", "Login", "Email", "Setor", "Nivel", "Ativo", "Status Cadastro", "Migrado Auth"];

  const linhas = dados.map((row) =>
    [
      row.id || "",
      row.nome || "",
      row.login || "",
      row.email || "",
      row.setor || "",
      row.nivel || "",
      row.ativo ? "Sim" : "Não",
      row.status_cadastro || "",
      row.migrado_auth ? "Sim" : "Não",
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

function ExplicacaoModal({ onClose }) {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm z-[70] p-4">
      <div className="bg-white p-6 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center mb-4 border-b pb-4 shrink-0">
          <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
            <FaInfoCircle className="text-blue-600" /> Regras de acesso
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-rose-500 hover:bg-rose-50 p-2 rounded-xl transition">
            <FaTimes size={20} />
          </button>
        </div>

        <div className="overflow-y-auto pr-2 space-y-5 text-sm text-slate-700">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <h3 className="font-black text-slate-800 mb-2 flex items-center gap-2"><FaShieldAlt className="text-slate-500" /> Base de usuários</h3>
            <p>O painel usa a tabela <strong>usuarios_aprovadores</strong> para controlar login, nível, setor, status ativo e vínculo com Auth.</p>
          </div>

          <div className="bg-blue-50 p-4 rounded-xl border border-blue-200">
            <h3 className="font-black text-blue-900 mb-2 flex items-center gap-2"><FaUserClock className="text-blue-600" /> Cadastros pendentes</h3>
            <p>Usuários com nível ou status de cadastro <strong>Pendente</strong> devem ser revisados pelo administrador antes da liberação.</p>
          </div>

          <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200">
            <h3 className="font-black text-emerald-900 mb-2 flex items-center gap-2"><FaUserCheck className="text-emerald-600" /> Ativo / Inativo</h3>
            <p>O campo <strong>ativo</strong> libera ou bloqueia o acesso. Usuário inativo não deve conseguir acessar o portal.</p>
          </div>

          <div className="bg-amber-50 p-4 rounded-xl border border-amber-200">
            <h3 className="font-black text-amber-900 mb-2 flex items-center gap-2"><FaCrown className="text-amber-600" /> Administrador</h3>
            <p>O nível <strong>Administrador</strong> representa controle total de gestão de acesso e deve ser usado apenas para perfis autorizados.</p>
          </div>
        </div>

        <div className="mt-5 pt-4 border-t flex justify-end shrink-0">
          <button onClick={onClose} className="px-6 py-2.5 bg-blue-600 text-white font-black rounded-xl hover:bg-blue-700 transition shadow-md active:scale-95">
            Entendi
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Usuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState(null);
  const [busca, setBusca] = useState("");
  const [nivelFiltro, setNivelFiltro] = useState("");
  const [statusFiltro, setStatusFiltro] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [mostrarExplicacao, setMostrarExplicacao] = useState(false);

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
      setFeedback({ type: "error", text: "Erro ao atualizar o nivel do usuario." });
      setSavingId(null);
      return;
    }

    setUsuarios((prev) => prev.map((usuario) => (usuario.id === id ? { ...usuario, nivel } : usuario)));
    setFeedback({ type: "success", text: `Nivel atualizado com sucesso para ${nivel}.` });
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
      setFeedback({ type: "error", text: "Erro ao atualizar o status do usuario." });
      setSavingId(null);
      return;
    }

    setUsuarios((prev) => prev.map((usuario) => (usuario.id === id ? { ...usuario, ativo: novoStatus } : usuario)));
    setFeedback({ type: "success", text: `Usuario ${novoStatus ? "ativado" : "desativado"} com sucesso.` });
    setSavingId(null);
  }

  const filtrados = useMemo(() => {
    const term = normalizeText(busca);

    return usuarios.filter((usuario) => {
      if (term && !buildSearchBlob(usuario).includes(term)) return false;
      if (nivelFiltro && usuario?.nivel !== nivelFiltro) return false;
      if (statusFiltro === "ativo" && !usuario?.ativo) return false;
      if (statusFiltro === "inativo" && usuario?.ativo) return false;
      if (statusFiltro === "pendente") {
        const pendente = normalizeText(usuario?.nivel) === "pendente" || normalizeText(usuario?.status_cadastro) === "pendente";
        if (!pendente) return false;
      }
      return true;
    });
  }, [usuarios, busca, nivelFiltro, statusFiltro]);

  const metricas = useMemo(() => {
    const total = usuarios.length;
    const ativos = usuarios.filter((usuario) => usuario?.ativo).length;
    const pendentes = usuarios.filter(
      (usuario) => normalizeText(usuario?.nivel) === "pendente" || normalizeText(usuario?.status_cadastro) === "pendente"
    ).length;
    const administradores = usuarios.filter((usuario) => normalizeText(usuario?.nivel) === "administrador").length;

    return { total, ativos, pendentes, administradores };
  }, [usuarios]);

  return (
    <div className="min-h-screen bg-slate-50 p-4 space-y-5">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 md:p-5">
        <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-black border border-blue-200">
              <FaShieldAlt /> Governança de Acesso
            </div>
            <h1 className="mt-3 text-2xl font-black text-slate-800">Gerenciar usuários</h1>
            <p className="text-sm text-slate-500 mt-1 flex items-center gap-2 font-semibold">
              <FaUsers /> Controle de níveis, status e liberações de acesso ao portal.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => exportarCSV(filtrados, "Usuarios_aprovadores")}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-500 transition shadow-sm"
            >
              <FaDownload /> Exportar Dados
            </button>
            <button
              onClick={() => setMostrarExplicacao(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-100 text-blue-800 font-bold hover:bg-blue-200 transition"
            >
              <FaInfoCircle /> Entender Regras
            </button>
            <button
              onClick={carregarUsuarios}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-800 bg-slate-800 text-white font-black hover:bg-slate-700 transition disabled:opacity-70"
            >
              <FaSync className={loading ? "animate-spin" : ""} /> {loading ? "Atualizando..." : "Atualizar"}
            </button>
          </div>
        </div>

        <div className="mt-5 pt-5 border-t grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div className="md:col-span-2">
            <label className="text-[10px] font-black text-slate-500 uppercase mb-1 block">Busca</label>
            <div className="relative">
              <FaSearch className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por nome, login, e-mail, nível ou setor..."
                value={busca}
                onChange={(event) => setBusca(event.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-11 pr-4 text-sm font-bold text-slate-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase mb-1 block">Nível</label>
            <select
              value={nivelFiltro}
              onChange={(event) => setNivelFiltro(event.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
            >
              <option value="">Todos os níveis</option>
              {NIVEIS.map((nivel) => <option key={nivel} value={nivel}>{nivel}</option>)}
            </select>
          </div>

          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase mb-1 block">Status</label>
            <select
              value={statusFiltro}
              onChange={(event) => setStatusFiltro(event.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
            >
              <option value="">Todos</option>
              <option value="ativo">Ativos</option>
              <option value="inativo">Inativos</option>
              <option value="pendente">Pendentes</option>
            </select>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 items-center">
          <button
            onClick={() => {
              setBusca("");
              setNivelFiltro("");
              setStatusFiltro("");
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
        <CardKPI title="Total" value={fmtInt(metricas.total)} sub="Usuários carregados" icon={<FaUsers />} tone="slate" />
        <CardKPI title="Ativos" value={fmtInt(metricas.ativos)} sub="Acessos liberados" icon={<FaUserCheck />} tone="emerald" />
        <CardKPI title="Pendentes" value={fmtInt(metricas.pendentes)} sub="Aguardando aprovação" icon={<FaUserClock />} tone="blue" />
        <CardKPI title="Administradores" value={fmtInt(metricas.administradores)} sub="Controle total" icon={<FaCrown />} tone="amber" />
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-black text-slate-800">Base de usuários</h3>
            <p className="text-xs text-slate-500 font-semibold">Altere nível e status diretamente na tabela.</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse min-w-[1200px]">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="p-3 font-black">Usuário</th>
                <th className="p-3 font-black">Login</th>
                <th className="p-3 font-black">Contato</th>
                <th className="p-3 font-black">Nível</th>
                <th className="p-3 font-black">Status</th>
                <th className="p-3 font-black text-right">Ações</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="p-8 text-center text-slate-400 font-bold">Atualizando base de usuários...</td></tr>
              ) : filtrados.length === 0 ? (
                <tr><td colSpan={6} className="p-8 text-center text-slate-400 font-bold">Nenhum usuário encontrado para o filtro aplicado.</td></tr>
              ) : (
                filtrados.map((usuario) => {
                  const isSaving = savingId === usuario.id;
                  const statusCadastro = usuario?.status_cadastro || "Aprovado";
                  const setor = usuario?.setor || "Nao informado";

                  return (
                    <tr key={usuario.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                      <td className="p-3">
                        <div className="flex min-w-[260px] items-start gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 border border-blue-100">
                            <FaUsers />
                          </div>
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-black text-slate-800">{usuario?.nome || "Sem nome"}</p>
                              <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-black text-slate-600 border border-slate-200">
                                ID {usuario.id}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 font-semibold">Setor: {setor}</p>
                          </div>
                        </div>
                      </td>

                      <td className="p-3">
                        <p className="font-bold text-slate-800">{usuario?.login || "-"}</p>
                        <p className="text-xs text-slate-500 font-semibold">{statusCadastro}</p>
                      </td>

                      <td className="p-3">
                        <p className="font-bold text-slate-700">{usuario?.email || "Sem e-mail"}</p>
                        <p className="text-xs text-slate-500 font-semibold">{usuario?.migrado_auth ? "Vinculado ao Auth" : "Sem vínculo Auth"}</p>
                      </td>

                      <td className="p-3">
                        <div className="flex items-center gap-3">
                          <span className={`inline-flex rounded-lg px-2.5 py-1 text-[11px] font-black border ${getNivelTone(usuario?.nivel)}`}>
                            {usuario?.nivel || "Pendente"}
                          </span>
                          <select
                            value={usuario?.nivel || "Pendente"}
                            disabled={isSaving}
                            onChange={(event) => atualizarNivel(usuario.id, event.target.value)}
                            className="min-w-[160px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 disabled:opacity-60"
                          >
                            {NIVEIS.map((nivel) => (
                              <option key={nivel} value={nivel}>{nivel}</option>
                            ))}
                          </select>
                        </div>
                      </td>

                      <td className="p-3">
                        <span className={`inline-flex rounded-lg px-2.5 py-1 text-[11px] font-black border ${getStatusTone(!!usuario?.ativo)}`}>
                          {usuario?.ativo ? "Ativo" : "Inativo"}
                        </span>
                        <div className="text-xs text-slate-500 font-semibold mt-1">{usuario?.ativo ? "Acesso liberado" : "Acesso bloqueado"}</div>
                      </td>

                      <td className="p-3">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => alternarAtivo(usuario.id, usuario?.ativo)}
                            disabled={isSaving}
                            className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold text-white transition disabled:opacity-60 ${usuario?.ativo ? "bg-rose-500 hover:bg-rose-600" : "bg-emerald-600 hover:bg-emerald-700"}`}
                          >
                            {usuario?.ativo ? <FaUserSlash /> : <FaCheckCircle />}
                            {usuario?.ativo ? "Desativar" : "Ativar"}
                          </button>

                          <button
                            onClick={() => atualizarNivel(usuario.id, "Administrador")}
                            disabled={isSaving}
                            className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-3 py-2 text-sm font-bold text-white transition hover:bg-amber-600 disabled:opacity-60"
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
      </div>

      {loading && (
        <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-[1px] flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl px-6 py-4 shadow-xl border border-slate-200 font-black text-slate-800">
            Carregando usuários...
          </div>
        </div>
      )}

      {mostrarExplicacao && <ExplicacaoModal onClose={() => setMostrarExplicacao(false)} />}
    </div>
  );
}
