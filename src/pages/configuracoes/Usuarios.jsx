import { useEffect, useMemo, useState } from "react";
import {
  FaBan,
  FaCheckCircle,
  FaCrown,
  FaDownload,
  FaFilter,
  FaInfoCircle,
  FaEye,
  FaKey,
  FaSave,
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
import { useAccessGovernance } from "../../context/AccessContext";
import { useAuth } from "../../context/AuthContext";
import { APP_ACCESS_PAGES } from "../../utils/accessCatalog";
import { formatPresenceTimestamp, isPresenceOnline } from "../../utils/presence";

const FALLBACK_NIVEIS = [
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

const PAGINAS_POR_CATEGORIA = APP_ACCESS_PAGES.reduce((acc, page) => {
  if (!acc[page.category]) acc[page.category] = [];
  acc[page.category].push(page);
  return acc;
}, {});

function normalizeText(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function isUsuarioAtivo(value) {
  if (value === true) return true;
  if (value === false) return false;

  const clean = normalizeText(value);

  if (["true", "t", "1", "sim", "ativo", "active"].includes(clean)) return true;
  if (["false", "f", "0", "nao", "não", "inativo", "inactive"].includes(clean)) return false;

  return false;
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

function getPresenceTone(isOnline) {
  return isOnline
    ? "bg-blue-50 text-blue-700 border-blue-200"
    : "bg-slate-100 text-slate-700 border-slate-200";
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

  const cabecalho = [
    "ID",
    "Nome",
    "Login",
    "Email",
    "Setor",
    "Nivel",
    "Ativo",
    "Status Cadastro",
    "Migrado Auth",
    "Online",
    "Ultimo Ping",
  ];

  const linhas = dados.map((row) =>
    [
      row.id || "",
      row.nome || "",
      row.login || "",
      row.email || "",
      row.setor || "",
      row.nivel || "",
      isUsuarioAtivo(row.ativo) ? "Sim" : "Não",
      row.status_cadastro || "",
      row.migrado_auth ? "Sim" : "Não",
      isPresenceOnline(row.ultimo_ping_em) ? "Sim" : "Nao",
      formatPresenceTimestamp(row.ultimo_ping_em),
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


function UsuarioDetalhesModal({ usuario, onClose, onResetSenha, saving }) {
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [confirmou, setConfirmou] = useState(false);

  if (!usuario) return null;

  const ativo = isUsuarioAtivo(usuario?.ativo);
  const online = isPresenceOnline(usuario?.ultimo_ping_em);

  function campo(label, value) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
        <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">{label}</p>
        <p className="mt-1 text-sm font-bold text-slate-800 break-words">{value || "—"}</p>
      </div>
    );
  }

  async function handleResetSenha() {
    if (!novaSenha || !confirmarSenha) {
      alert("Informe e confirme a nova senha temporária.");
      return;
    }

    if (novaSenha.length < 6) {
      alert("A nova senha precisa ter pelo menos 6 caracteres.");
      return;
    }

    if (novaSenha !== confirmarSenha) {
      alert("As senhas não conferem.");
      return;
    }

    if (!confirmou) {
      alert("Confirme que o usuário deverá redefinir a senha antes de acessar o sistema.");
      return;
    }

    await onResetSenha(usuario, novaSenha);
    setNovaSenha("");
    setConfirmarSenha("");
    setConfirmou(false);
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-blue-600 text-white flex items-center justify-center">
              <FaUsers />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-800">Detalhes do usuário</h2>
              <p className="text-xs text-slate-500 font-semibold">
                {usuario?.nome || "Sem nome"} • ID {usuario?.id}
              </p>
            </div>
          </div>

          <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition">
            <FaTimes />
          </button>
        </div>

        <div className="overflow-y-auto p-5 space-y-5 bg-slate-50/60">
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider mb-4">Dados cadastrais</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {campo("ID", usuario?.id)}
              {campo("Nome", usuario?.nome)}
              {campo("Login", usuario?.login)}
              {campo("E-mail", usuario?.email)}
              {campo("Setor", usuario?.setor)}
              {campo("Nível", usuario?.nivel || "Pendente")}
              {campo("Status Cadastro", usuario?.status_cadastro || "Aprovado")}
              {campo("Ativo", ativo ? "Sim" : "Não")}
              {campo("Sessao", online ? "Online agora" : "Offline")}
              {campo("Ultimo ping", formatPresenceTimestamp(usuario?.ultimo_ping_em))}
              {campo("Auth User ID", usuario?.auth_user_id)}
              {campo("Migrado Auth", usuario?.migrado_auth ? "Sim" : "Não")}
              {campo("Precisa redefinir senha", usuario?.precisa_redefinir_senha ? "Sim" : "Não")}
              {campo("Senha alterada em", usuario?.senha_alterada_em)}
              {campo("Senha alterada por", usuario?.senha_alterada_por)}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-amber-200 p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <FaKey />
              </div>

              <div className="flex-1">
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">Reset de senha</h3>
                <p className="text-xs text-slate-500 font-semibold mt-1">
                  A senha atual não é exibida por segurança. Defina uma senha temporária e marque o usuário para redefinir antes de acessar o sistema.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-500">Nova senha temporária</label>
                    <input
                      type="password"
                      value={novaSenha}
                      onChange={(e) => setNovaSenha(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                      placeholder="Mínimo 6 caracteres"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-500">Confirmar senha</label>
                    <input
                      type="password"
                      value={confirmarSenha}
                      onChange={(e) => setConfirmarSenha(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                      placeholder="Repita a senha"
                    />
                  </div>
                </div>

                <label className="mt-4 flex items-start gap-2 text-sm font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={confirmou}
                    onChange={(e) => setConfirmou(e.target.checked)}
                    className="mt-1"
                  />
                  O usuário deverá criar uma nova senha antes de continuar usando o sistema.
                </label>

                <div className="mt-4 flex justify-end">
                  <button
                    onClick={handleResetSenha}
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-black text-white hover:bg-amber-600 disabled:opacity-60"
                  >
                    <FaSave />
                    {saving ? "Salvando..." : "Salvar reset de senha"}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-sm text-blue-800 font-semibold">
            Regra: após o reset, o próximo login solicita a criação de uma nova senha. Depois da confirmação, o acesso é liberado normalmente.
          </div>
        </div>
      </div>
    </div>
  );
}

function PermissoesUsuarioModal({ usuario, onClose, onSave, saving }) {
  const [paginasLiberadas, setPaginasLiberadas] = useState(
    Array.isArray(usuario?.paginas_liberadas) ? usuario.paginas_liberadas : []
  );
  const [paginasBloqueadas, setPaginasBloqueadas] = useState(
    Array.isArray(usuario?.paginas_bloqueadas) ? usuario.paginas_bloqueadas : []
  );

  function getState(pageKey) {
    if (paginasLiberadas.includes(pageKey)) return "liberar";
    if (paginasBloqueadas.includes(pageKey)) return "bloquear";
    return "herdar";
  }

  function setState(pageKey, state) {
    if (state === "liberar") {
      setPaginasLiberadas((current) => Array.from(new Set([...current.filter((item) => item !== pageKey), pageKey])));
      setPaginasBloqueadas((current) => current.filter((item) => item !== pageKey));
      return;
    }

    if (state === "bloquear") {
      setPaginasBloqueadas((current) => Array.from(new Set([...current.filter((item) => item !== pageKey), pageKey])));
      setPaginasLiberadas((current) => current.filter((item) => item !== pageKey));
      return;
    }

    setPaginasLiberadas((current) => current.filter((item) => item !== pageKey));
    setPaginasBloqueadas((current) => current.filter((item) => item !== pageKey));
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-6xl max-h-[92vh] overflow-hidden rounded-2xl bg-white shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b bg-slate-50">
          <div>
            <h2 className="text-lg font-black text-slate-800">Permissões por usuário</h2>
            <p className="text-xs font-semibold text-slate-500">
              {usuario?.nome || "Usuário"} • Nível base: {usuario?.nivel || "Pendente"}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50">
            <FaTimes />
          </button>
        </div>

        <div className="overflow-y-auto p-5 space-y-4 bg-slate-50/70">
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm font-semibold text-blue-800">
            Use <strong>Herdar</strong> para seguir o nível. Use <strong>Liberar</strong> para abrir uma página só para esse usuário e <strong>Bloquear</strong> para esconder uma página mesmo que o nível permita.
          </div>

          {Object.entries(PAGINAS_POR_CATEGORIA).map(([categoria, paginas]) => (
            <div key={categoria} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-800 mb-3">{categoria}</h3>
              <div className="space-y-3">
                {paginas.map((pagina) => (
                  <div key={pagina.key} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                      <div>
                        <p className="text-sm font-black text-slate-800">{pagina.label}</p>
                        <p className="text-[11px] font-semibold text-slate-500 mt-1">{pagina.path}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {[
                          { value: "herdar", label: "Herdar" },
                          { value: "liberar", label: "Liberar" },
                          { value: "bloquear", label: "Bloquear" },
                        ].map((option) => {
                          const active = getState(pagina.key) === option.value;
                          return (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => setState(pagina.key, option.value)}
                              className={`rounded-xl px-3 py-2 text-xs font-black transition ${
                                active
                                  ? option.value === "liberar"
                                    ? "bg-emerald-600 text-white"
                                    : option.value === "bloquear"
                                    ? "bg-rose-600 text-white"
                                    : "bg-slate-800 text-white"
                                  : "bg-white text-slate-700 border border-slate-200"
                              }`}
                            >
                              {option.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="px-5 py-4 border-t bg-white flex justify-end gap-3">
          <button onClick={onClose} className="rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-black text-slate-700 hover:bg-slate-200">
            Cancelar
          </button>
          <button
            onClick={() => onSave(usuario, paginasLiberadas, paginasBloqueadas)}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-black text-white hover:bg-blue-700 disabled:opacity-60"
          >
            <FaSave />
            {saving ? "Salvando..." : "Salvar permissões"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Usuarios() {
  const { profiles } = useAccessGovernance();
  const { user: currentUser, login: persistCurrentUser } = useAuth();
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState(null);
  const [busca, setBusca] = useState("");
  const [nivelFiltro, setNivelFiltro] = useState("");
  const [statusFiltro, setStatusFiltro] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [mostrarExplicacao, setMostrarExplicacao] = useState(false);
  const [usuarioSelecionado, setUsuarioSelecionado] = useState(null);
  const [usuarioPermissoes, setUsuarioPermissoes] = useState(null);
  const [resetandoSenha, setResetandoSenha] = useState(false);
  const niveisDisponiveis = useMemo(() => {
    const nomes = profiles?.length ? profiles.map((item) => item.nome) : FALLBACK_NIVEIS;
    return Array.from(new Set(nomes)).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [profiles]);

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
    if (currentUser?.usuario_id === id || currentUser?.id === id) {
      persistCurrentUser({ ...currentUser, nivel });
    }
    setFeedback({ type: "success", text: `Nivel atualizado com sucesso para ${nivel}.` });
    setSavingId(null);
  }

  async function alternarAtivo(id, atual) {
    const ativoAtual = isUsuarioAtivo(atual);
    const novoStatus = !ativoAtual;

    setSavingId(id);
    setFeedback(null);

    const { data, error } = await supabase
      .from("usuarios_aprovadores")
      .update({ ativo: novoStatus })
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      console.error(error.message);
      setFeedback({ type: "error", text: "Erro ao atualizar o status do usuario." });
      setSavingId(null);
      return;
    }

    setUsuarios((prev) => prev.map((usuario) => (usuario.id === id ? data : usuario)));
    if (usuarioSelecionado?.id === id) setUsuarioSelecionado(data);
    if (currentUser?.usuario_id === id || currentUser?.id === id) {
      persistCurrentUser({ ...currentUser, ...data });
    }

    setFeedback({ type: "success", text: `Usuario ${novoStatus ? "ativado" : "desativado"} com sucesso.` });
    setSavingId(null);
  }

  async function resetarSenhaUsuario(usuario, novaSenha) {
    if (!usuario?.id) return;

    setResetandoSenha(true);
    setFeedback(null);

    const payload = {
      senha: novaSenha,
      precisa_redefinir_senha: true,
      senha_alterada_em: new Date().toISOString(),
      senha_alterada_por: "admin",
    };

    const { data, error } = await supabase
      .from("usuarios_aprovadores")
      .update(payload)
      .eq("id", usuario.id)
      .select("*")
      .single();

    if (error) {
      console.error(error.message);
      setFeedback({ type: "error", text: "Erro ao redefinir a senha do usuário." });
      setResetandoSenha(false);
      return;
    }

    setUsuarios((prev) => prev.map((item) => (item.id === usuario.id ? data : item)));
    setUsuarioSelecionado(data);
    setFeedback({
      type: "success",
      text: `Senha redefinida para ${data?.nome || "usuário"}. Ele deverá criar uma nova senha no próximo login.`,
    });
    setResetandoSenha(false);
  }

  async function salvarPermissoesUsuario(usuario, paginasLiberadas, paginasBloqueadas) {
    if (!usuario?.id) return;

    setSavingId(usuario.id);
    setFeedback(null);

    const { data, error } = await supabase
      .from("usuarios_aprovadores")
      .update({
        paginas_liberadas: Array.isArray(paginasLiberadas) ? paginasLiberadas : [],
        paginas_bloqueadas: Array.isArray(paginasBloqueadas) ? paginasBloqueadas : [],
      })
      .eq("id", usuario.id)
      .select("*")
      .single();

    if (error) {
      console.error(error.message);
      setFeedback({ type: "error", text: "Erro ao salvar as permissões personalizadas." });
      setSavingId(null);
      return;
    }

    setUsuarios((prev) => prev.map((item) => (item.id === usuario.id ? data : item)));
    if (usuarioSelecionado?.id === usuario.id) setUsuarioSelecionado(data);
    if (currentUser?.usuario_id === usuario.id || currentUser?.id === usuario.id) {
      persistCurrentUser({ ...currentUser, ...data });
    }
    setUsuarioPermissoes(null);
    setFeedback({
      type: "success",
      text: `Permissões personalizadas salvas para ${data?.nome || "usuário"}.`,
    });
    setSavingId(null);
  }

  const filtrados = useMemo(() => {
    const term = normalizeText(busca);

    return usuarios.filter((usuario) => {
      if (term && !buildSearchBlob(usuario).includes(term)) return false;
      if (nivelFiltro && usuario?.nivel !== nivelFiltro) return false;
      const ativo = isUsuarioAtivo(usuario?.ativo);
      if (statusFiltro === "ativo" && !ativo) return false;
      if (statusFiltro === "inativo" && ativo) return false;
      if (statusFiltro === "pendente") {
        const pendente = normalizeText(usuario?.nivel) === "pendente" || normalizeText(usuario?.status_cadastro) === "pendente";
        if (!pendente) return false;
      }
      return true;
    });
  }, [usuarios, busca, nivelFiltro, statusFiltro]);

  const metricas = useMemo(() => {
    const total = usuarios.length;
    const ativos = usuarios.filter((usuario) => isUsuarioAtivo(usuario?.ativo)).length;
    const pendentes = usuarios.filter(
      (usuario) => normalizeText(usuario?.nivel) === "pendente" || normalizeText(usuario?.status_cadastro) === "pendente"
    ).length;
    const administradores = usuarios.filter((usuario) => normalizeText(usuario?.nivel) === "administrador").length;
    const online = usuarios.filter((usuario) => isPresenceOnline(usuario?.ultimo_ping_em)).length;

    return { total, ativos, pendentes, administradores, online };
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
              {niveisDisponiveis.map((nivel) => <option key={nivel} value={nivel}>{nivel}</option>)}
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

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
        <CardKPI title="Total" value={fmtInt(metricas.total)} sub="Usuários carregados" icon={<FaUsers />} tone="slate" />
        <CardKPI title="Ativos" value={fmtInt(metricas.ativos)} sub="Acessos liberados" icon={<FaUserCheck />} tone="emerald" />
        <CardKPI title="Pendentes" value={fmtInt(metricas.pendentes)} sub="Aguardando aprovação" icon={<FaUserClock />} tone="blue" />
        <CardKPI title="Administradores" value={fmtInt(metricas.administradores)} sub="Controle total" icon={<FaCrown />} tone="amber" />
        <CardKPI title="Online agora" value={fmtInt(metricas.online)} sub="Atividade recente" icon={<FaSync />} tone="violet" />
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-black text-slate-800">Base de usuários</h3>
            <p className="text-xs text-slate-500 font-semibold">Altere nível e status diretamente na tabela.</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse min-w-[1320px]">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="p-3 font-black">Usuário</th>
                <th className="p-3 font-black">Login</th>
                <th className="p-3 font-black">Contato</th>
                <th className="p-3 font-black">Nível</th>
                <th className="p-3 font-black">Status</th>
                <th className="p-3 font-black">Sessao</th>
                <th className="p-3 font-black text-right">Ações</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="p-8 text-center text-slate-400 font-bold">Atualizando base de usuários...</td></tr>
              ) : filtrados.length === 0 ? (
                <tr><td colSpan={7} className="p-8 text-center text-slate-400 font-bold">Nenhum usuário encontrado para o filtro aplicado.</td></tr>
              ) : (
                filtrados.map((usuario) => {
                  const isSaving = savingId === usuario.id;
                  const statusCadastro = usuario?.status_cadastro || "Aprovado";
                  const setor = usuario?.setor || "Nao informado";
                  const ativo = isUsuarioAtivo(usuario?.ativo);
                  const online = isPresenceOnline(usuario?.ultimo_ping_em);

                  return (
                    <tr
                      key={usuario.id}
                      onClick={() => setUsuarioSelecionado(usuario)}
                      className="border-b border-slate-100 last:border-0 hover:bg-blue-50/60 transition-colors cursor-pointer"
                    >
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
                            onClick={(event) => event.stopPropagation()}
                            onChange={(event) => atualizarNivel(usuario.id, event.target.value)}
                            className="min-w-[160px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 disabled:opacity-60"
                          >
                            {niveisDisponiveis.map((nivel) => (
                              <option key={nivel} value={nivel}>{nivel}</option>
                            ))}
                          </select>
                        </div>
                      </td>

                      <td className="p-3">
                        <span className={`inline-flex rounded-lg px-2.5 py-1 text-[11px] font-black border ${getStatusTone(ativo)}`}>
                          {ativo ? "Ativo" : "Inativo"}
                        </span>
                        <div className="text-xs text-slate-500 font-semibold mt-1">{ativo ? "Acesso liberado" : "Acesso bloqueado"}</div>
                      </td>

                      <td className="p-3">
                        <span className={`inline-flex rounded-lg px-2.5 py-1 text-[11px] font-black border ${getPresenceTone(online)}`}>
                          {online ? "Online" : "Offline"}
                        </span>
                        <div className="text-xs text-slate-500 font-semibold mt-1">
                          {online ? "Ativo nos ultimos 2 min" : `Ultimo ping: ${formatPresenceTimestamp(usuario?.ultimo_ping_em)}`}
                        </div>
                      </td>

                      <td className="p-3">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              setUsuarioSelecionado(usuario);
                            }}
                            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-sm font-bold text-white transition hover:bg-blue-700"
                          >
                            <FaEye />
                            Detalhes
                          </button>

                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              setUsuarioPermissoes(usuario);
                            }}
                            className="inline-flex items-center gap-2 rounded-xl bg-slate-700 px-3 py-2 text-sm font-bold text-white transition hover:bg-slate-800"
                          >
                            <FaShieldAlt />
                            Páginas
                          </button>

                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              alternarAtivo(usuario.id, ativo);
                            }}
                            disabled={isSaving}
                            className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold text-white transition disabled:opacity-60 ${ativo ? "bg-rose-500 hover:bg-rose-600" : "bg-emerald-600 hover:bg-emerald-700"}`}
                          >
                            {ativo ? <FaUserSlash /> : <FaCheckCircle />}
                            {ativo ? "Desativar" : "Ativar"}
                          </button>

                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              atualizarNivel(usuario.id, "Administrador");
                            }}
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

      {usuarioSelecionado && (
        <UsuarioDetalhesModal
          usuario={usuarioSelecionado}
          onClose={() => setUsuarioSelecionado(null)}
          onResetSenha={resetarSenhaUsuario}
          saving={resetandoSenha}
        />
      )}

      {usuarioPermissoes && (
        <PermissoesUsuarioModal
          usuario={usuarioPermissoes}
          onClose={() => setUsuarioPermissoes(null)}
          onSave={salvarPermissoesUsuario}
          saving={savingId === usuarioPermissoes.id}
        />
      )}
    </div>
  );
}
