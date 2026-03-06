import { useEffect, useState, useContext } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../supabase";
import { AuthContext } from "../../context/AuthContext";
import {
  FaArrowLeft,
  FaCalendarAlt,
  FaMapMarkerAlt,
  FaUser,
  FaWrench,
  FaImage,
  FaEdit,
  FaSave,
  FaTimes,
  FaTrash,
  FaLock,
} from "react-icons/fa";

const PRIORIDADES = ["BAIXA", "MEDIA", "ALTA", "CRITICA"];
const STATUS = ["ABERTA", "EM_ANALISE", "EM_EXECUCAO", "AG_PECAS", "CONCLUIDA", "CANCELADA"];
const TIPOS = [
  "TELEMETRIA",
  "CAMERAS",
  "VISION",
  "VALIDADOR",
  "CHIP_VALIDADOR",
  "GPS",
];

function isValidUUID(v) {
  if (!v) return false;
  const s = String(v).trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

function pickUserUuid(user) {
  if (isValidUUID(user?.auth_user_id)) return user.auth_user_id;
  if (isValidUUID(user?.id)) return user.id;
  return null;
}

function buildNomeSobrenome(u) {
  const nome = String(u?.nome || "").trim();
  const sobrenome = String(u?.sobrenome || "").trim();
  const nomeCompleto = String(u?.nome_completo || "").trim();

  if (nomeCompleto) return nomeCompleto;
  if (nome && sobrenome) return `${nome} ${sobrenome}`;
  if (nome) return nome;
  return null;
}

function formatDateTimeBR(v) {
  if (!v) return "-";
  try {
    return new Date(v).toLocaleString("pt-BR");
  } catch {
    return "-";
  }
}

function statusLabel(status) {
  switch (status) {
    case "EM_ANALISE":
      return "EM ANÁLISE";
    case "EM_EXECUCAO":
      return "EM EXECUÇÃO";
    case "AG_PECAS":
      return "AG. PEÇAS";
    case "CONCLUIDA":
      return "CONCLUÍDA";
    case "CANCELADA":
      return "CANCELADA";
    default:
      return status || "-";
  }
}

function prioridadeLabel(p) {
  switch (p) {
    case "MEDIA":
      return "MÉDIA";
    case "CRITICA":
      return "CRÍTICA";
    default:
      return p || "-";
  }
}

function statusClass(status) {
  switch (status) {
    case "ABERTA":
      return "bg-blue-50 text-blue-700 ring-1 ring-blue-200";
    case "EM_ANALISE":
      return "bg-yellow-50 text-yellow-800 ring-1 ring-yellow-200";
    case "EM_EXECUCAO":
      return "bg-orange-50 text-orange-700 ring-1 ring-orange-200";
    case "AG_PECAS":
      return "bg-purple-50 text-purple-700 ring-1 ring-purple-200";
    case "CONCLUIDA":
      return "bg-green-50 text-green-700 ring-1 ring-green-200";
    case "CANCELADA":
      return "bg-gray-100 text-gray-700 ring-1 ring-gray-200";
    default:
      return "bg-gray-100 text-gray-700 ring-1 ring-gray-200";
  }
}

function prioridadeClass(p) {
  switch (p) {
    case "CRITICA":
      return "bg-red-50 text-red-700 ring-1 ring-red-200";
    case "ALTA":
      return "bg-orange-50 text-orange-700 ring-1 ring-orange-200";
    case "MEDIA":
      return "bg-yellow-50 text-yellow-800 ring-1 ring-yellow-200";
    case "BAIXA":
      return "bg-green-50 text-green-700 ring-1 ring-green-200";
    default:
      return "bg-gray-100 text-gray-700 ring-1 ring-gray-200";
  }
}

function EmptyPhoto() {
  return (
    <div className="w-full h-80 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 flex items-center justify-center text-slate-400 text-sm font-bold">
      Sem foto
    </div>
  );
}

function PasswordModal({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirmar",
  loading = false,
}) {
  const [senha, setSenha] = useState("");

  useEffect(() => {
    if (open) setSenha("");
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="px-5 py-4 border-b">
          <div className="flex items-center gap-2 text-slate-900 font-black text-lg">
            <FaLock />
            {title}
          </div>
          <div className="text-sm text-slate-500 font-semibold mt-1">{description}</div>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="text-[10px] font-black uppercase text-slate-500 mb-1 block">
              Senha
            </label>
            <input
              type="password"
              className="w-full border border-slate-300 rounded-2xl px-3 py-3 text-sm font-bold"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="Digite sua senha"
              autoFocus
            />
          </div>

          <div className="flex justify-between gap-2">
            <button
              onClick={onClose}
              className="px-4 py-3 rounded-2xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-sm font-black"
            >
              Cancelar
            </button>

            <button
              onClick={() => onConfirm(senha)}
              disabled={loading || !senha.trim()}
              className="px-4 py-3 rounded-2xl bg-slate-900 hover:bg-black text-white text-sm font-black disabled:opacity-60"
            >
              {loading ? "Validando..." : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ReparoSolicitacaoDetalhes() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

  const [row, setRow] = useState(null);
  const [loading, setLoading] = useState(true);

  const [nomeUsuario, setNomeUsuario] = useState("");
  const [loginUsuario, setLoginUsuario] = useState("");
  const [usuarioId, setUsuarioId] = useState(null);

  const [editando, setEditando] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const [showSenhaEditar, setShowSenhaEditar] = useState(false);
  const [showSenhaExcluir, setShowSenhaExcluir] = useState(false);
  const [validandoSenha, setValidandoSenha] = useState(false);

  const [form, setForm] = useState({
    veiculo: "",
    tipo_embarcado: "TELEMETRIA",
    problema: "",
    descricao: "",
    local_problema: "",
    prioridade: "MEDIA",
    status: "ABERTA",
  });

  async function carregarUsuarioSessao() {
    try {
      const loginSessao = user?.login || user?.email || null;
      const idSessao = pickUserUuid(user);

      let nomeSessao =
        buildNomeSobrenome(user) ||
        (user?.nome ? String(user.nome).trim() : null) ||
        (user?.nome_completo ? String(user.nome_completo).trim() : null) ||
        null;

      if (!nomeSessao && loginSessao) {
        const { data: u } = await supabase
          .from("usuarios_aprovadores")
          .select("nome, sobrenome, nome_completo")
          .eq("login", loginSessao)
          .maybeSingle();

        if (u) {
          nomeSessao =
            u?.nome_completo ||
            [u?.nome, u?.sobrenome].filter(Boolean).join(" ") ||
            u?.nome ||
            null;
        }
      }

      setNomeUsuario(nomeSessao || loginSessao || "");
      setLoginUsuario(loginSessao || "");
      setUsuarioId(idSessao || null);
    } catch {
      setNomeUsuario(user?.login || user?.email || "");
      setLoginUsuario(user?.login || user?.email || "");
      setUsuarioId(pickUserUuid(user));
    }
  }

  async function carregar() {
    setLoading(true);

    const { data, error } = await supabase
      .from("embarcados_solicitacoes_reparo")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) console.error(error);

    setRow(data || null);

    setForm({
      veiculo: data?.veiculo || "",
      tipo_embarcado: data?.tipo_embarcado || "TELEMETRIA",
      problema: data?.problema || "",
      descricao: data?.descricao || "",
      local_problema: data?.local_problema || "",
      prioridade: data?.prioridade || "MEDIA",
      status: data?.status || "ABERTA",
    });

    setLoading(false);
  }

  useEffect(() => {
    carregarUsuarioSessao();
  }, [user]);

  useEffect(() => {
    carregar();
  }, [id]);

  async function validarSenhaGestorOuAdmin(senhaDigitada) {
    setValidandoSenha(true);
    try {
      const loginSessao = loginUsuario || user?.login || user?.email;

      if (!loginSessao) {
        alert("Usuário logado não identificado.");
        return false;
      }

      const { data, error } = await supabase
        .from("usuarios_aprovadores")
        .select("login, senha, nivel, ativo")
        .eq("login", loginSessao)
        .eq("senha", senhaDigitada)
        .eq("ativo", true)
        .maybeSingle();

      if (error) {
        console.error(error);
        alert("Erro ao validar senha.");
        return false;
      }

      if (!data) {
        alert("Senha inválida.");
        return false;
      }

      if (!["Administrador", "Gestor"].includes(data.nivel)) {
        alert("Somente Gestor ou Administrador pode realizar esta ação.");
        return false;
      }

      return true;
    } finally {
      setValidandoSenha(false);
    }
  }

  async function gerarHistorico({
    statusEvento,
    acaoExecutada,
    diagnostico,
    observacao,
  }) {
    const payload = {
      solicitacao_id: row.id,
      status_evento: statusEvento || row.status,
      acao_executada: acaoExecutada || null,
      diagnostico: diagnostico || null,
      observacao: observacao || null,
      executado_por: nomeUsuario || loginUsuario || null,
      foto_url: null,
      criado_por_login: loginUsuario || null,
      criado_por_nome: nomeUsuario || loginUsuario || null,
      criado_por_id: usuarioId || null,
    };

    const { error } = await supabase
      .from("embarcados_solicitacoes_reparo_eventos")
      .insert([payload]);

    if (error) throw error;
  }

  async function confirmarEditar(senha) {
    const ok = await validarSenhaGestorOuAdmin(senha);
    if (!ok) return;

    setShowSenhaEditar(false);
    setEditando(true);
  }

  async function salvarEdicao() {
    try {
      setSalvando(true);

      const alteracoes = [];
      if (row.veiculo !== form.veiculo) alteracoes.push(`Veículo: ${row.veiculo || "-"} → ${form.veiculo || "-"}`);
      if (row.tipo_embarcado !== form.tipo_embarcado) alteracoes.push(`Tipo: ${row.tipo_embarcado || "-"} → ${form.tipo_embarcado || "-"}`);
      if (row.problema !== form.problema) alteracoes.push(`Problema: ${row.problema || "-"} → ${form.problema || "-"}`);
      if (row.local_problema !== form.local_problema) alteracoes.push(`Local: ${row.local_problema || "-"} → ${form.local_problema || "-"}`);
      if (row.descricao !== form.descricao) alteracoes.push(`Descrição alterada`);
      if (row.prioridade !== form.prioridade) alteracoes.push(`Prioridade: ${row.prioridade || "-"} → ${form.prioridade || "-"}`);
      if (row.status !== form.status) alteracoes.push(`Status: ${row.status || "-"} → ${form.status || "-"}`);

      const { error } = await supabase
        .from("embarcados_solicitacoes_reparo")
        .update({
          veiculo: form.veiculo,
          tipo_embarcado: form.tipo_embarcado,
          problema: form.problema,
          descricao: form.descricao,
          local_problema: form.local_problema,
          prioridade: form.prioridade,
          status: form.status,
        })
        .eq("id", row.id);

      if (error) {
        console.error(error);
        alert(error.message || "Erro ao salvar edição.");
        return;
      }

      await gerarHistorico({
        statusEvento: form.status,
        acaoExecutada: "EDIÇÃO DA SOLICITAÇÃO",
        diagnostico: alteracoes.join(" | "),
        observacao: `Solicitação editada por ${nomeUsuario || loginUsuario}.`,
      });

      setEditando(false);
      await carregar();
      alert("Alterações salvas com sucesso.");
    } catch (e) {
      console.error(e);
      alert(e?.message || "Erro ao gerar histórico da edição.");
    } finally {
      setSalvando(false);
    }
  }

  async function confirmarExcluir(senha) {
    const ok = await validarSenhaGestorOuAdmin(senha);
    if (!ok) return;

    try {
      setValidandoSenha(true);

      const { error } = await supabase
        .from("embarcados_solicitacoes_reparo")
        .update({
          status: "CANCELADA",
          observacao_execucao: `Solicitação excluída logicamente por ${nomeUsuario || loginUsuario}.`,
          executado_por: nomeUsuario || loginUsuario || null,
          data_fechamento: new Date().toISOString(),
        })
        .eq("id", row.id);

      if (error) {
        console.error(error);
        alert(error.message || "Erro ao excluir solicitação.");
        return;
      }

      await gerarHistorico({
        statusEvento: "CANCELADA",
        acaoExecutada: "EXCLUSÃO LÓGICA DA SOLICITAÇÃO",
        diagnostico: "Solicitação marcada como cancelada/excluída.",
        observacao: `Exclusão realizada por ${nomeUsuario || loginUsuario}.`,
      });

      setShowSenhaExcluir(false);
      await carregar();
      alert("Solicitação excluída com sucesso.");
    } catch (e) {
      console.error(e);
      alert(e?.message || "Erro ao gerar histórico da exclusão.");
    } finally {
      setValidandoSenha(false);
    }
  }

  if (loading) {
    return <div className="p-6 text-center font-black text-slate-500">Carregando detalhes...</div>;
  }

  if (!row) {
    return <div className="p-6 text-center font-black text-slate-500">Solicitação não encontrada.</div>;
  }

  const podeEditar = ["CONCLUIDA", "CANCELADA"].includes(row.status);

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="mx-auto max-w-[1500px] space-y-4">
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
            <div>
              <div className="flex flex-wrap gap-2 mb-3">
                <button
                  onClick={() => navigate("/embarcados-reparos")}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 text-sm font-black"
                >
                  <FaArrowLeft />
                  Voltar
                </button>

                {podeEditar && !editando && (
                  <button
                    onClick={() => setShowSenhaEditar(true)}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-yellow-500 hover:bg-yellow-400 text-white text-sm font-black"
                  >
                    <FaEdit />
                    Editar
                  </button>
                )}

                {podeEditar && !editando && (
                  <button
                    onClick={() => setShowSenhaExcluir(true)}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-black"
                  >
                    <FaTrash />
                    Excluir
                  </button>
                )}

                {editando && (
                  <>
                    <button
                      onClick={salvarEdicao}
                      disabled={salvando}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-green-600 hover:bg-green-500 text-white text-sm font-black disabled:opacity-60"
                    >
                      <FaSave />
                      {salvando ? "Salvando..." : "Salvar alterações"}
                    </button>

                    <button
                      onClick={() => {
                        setEditando(false);
                        setForm({
                          veiculo: row.veiculo || "",
                          tipo_embarcado: row.tipo_embarcado || "TELEMETRIA",
                          problema: row.problema || "",
                          descricao: row.descricao || "",
                          local_problema: row.local_problema || "",
                          prioridade: row.prioridade || "MEDIA",
                          status: row.status || "ABERTA",
                        });
                      }}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-300 hover:bg-slate-200 text-slate-800 text-sm font-black"
                    >
                      <FaTimes />
                      Cancelar edição
                    </button>
                  </>
                )}
              </div>

              <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
                Detalhes da solicitação
              </div>

              {editando ? (
                <input
                  className="mt-2 w-full max-w-2xl border border-slate-300 rounded-2xl px-3 py-3 text-2xl font-black text-slate-900"
                  value={form.problema}
                  onChange={(e) => setForm({ ...form, problema: e.target.value })}
                />
              ) : (
                <h1 className="text-3xl font-black tracking-tight text-slate-900 mt-1">
                  {row.problema}
                </h1>
              )}

              <p className="text-sm text-slate-500 font-semibold mt-1">
                {editando ? form.tipo_embarcado : row.tipo_embarcado} • Veículo {editando ? form.veiculo || "-" : row.veiculo || "-"}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <span className={`px-4 py-2 rounded-full text-xs font-black uppercase ${prioridadeClass(editando ? form.prioridade : row.prioridade)}`}>
                {prioridadeLabel(editando ? form.prioridade : row.prioridade)}
              </span>
              <span className={`px-4 py-2 rounded-full text-xs font-black uppercase ${statusClass(editando ? form.status : row.status)}`}>
                {statusLabel(editando ? form.status : row.status)}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-4">
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                <div className="text-[10px] font-black uppercase text-slate-500 flex items-center gap-2">
                  <FaCalendarAlt />
                  Criado em
                </div>
                <div className="mt-2 text-sm font-black text-slate-900">
                  {formatDateTimeBR(row.created_at)}
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                <div className="text-[10px] font-black uppercase text-slate-500 flex items-center gap-2">
                  <FaMapMarkerAlt />
                  Local do problema
                </div>

                {editando ? (
                  <input
                    className="mt-2 w-full border border-slate-300 rounded-xl px-3 py-2 text-sm font-bold"
                    value={form.local_problema}
                    onChange={(e) => setForm({ ...form, local_problema: e.target.value })}
                  />
                ) : (
                  <div className="mt-2 text-sm font-black text-slate-900">
                    {row.local_problema || "-"}
                  </div>
                )}
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                <div className="text-[10px] font-black uppercase text-slate-500 flex items-center gap-2">
                  <FaUser />
                  Solicitante
                </div>
                <div className="mt-2 text-sm font-black text-slate-900">
                  {row.solicitante || "-"}
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                <div className="text-[10px] font-black uppercase text-slate-500 flex items-center gap-2">
                  <FaWrench />
                  Executado por
                </div>
                <div className="mt-2 text-sm font-black text-slate-900">
                  {row.executado_por || "-"}
                </div>
              </div>
            </div>

            {editando && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                  <label className="text-[10px] font-black uppercase text-slate-500 mb-1 block">
                    Veículo
                  </label>
                  <input
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm font-bold"
                    value={form.veiculo}
                    onChange={(e) => setForm({ ...form, veiculo: e.target.value })}
                  />
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                  <label className="text-[10px] font-black uppercase text-slate-500 mb-1 block">
                    Tipo
                  </label>
                  <select
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm font-bold"
                    value={form.tipo_embarcado}
                    onChange={(e) => setForm({ ...form, tipo_embarcado: e.target.value })}
                  >
                    {TIPOS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                  <label className="text-[10px] font-black uppercase text-slate-500 mb-1 block">
                    Prioridade
                  </label>
                  <select
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm font-bold"
                    value={form.prioridade}
                    onChange={(e) => setForm({ ...form, prioridade: e.target.value })}
                  >
                    {PRIORIDADES.map((p) => (
                      <option key={p} value={p}>
                        {prioridadeLabel(p)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 md:col-span-3">
                  <label className="text-[10px] font-black uppercase text-slate-500 mb-1 block">
                    Status
                  </label>
                  <select
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm font-bold"
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                  >
                    {STATUS.map((s) => (
                      <option key={s} value={s}>
                        {statusLabel(s)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <div className="text-[10px] font-black uppercase text-slate-500">
                Descrição da solicitação
              </div>

              {editando ? (
                <textarea
                  className="mt-3 w-full border border-slate-300 rounded-2xl px-3 py-3 text-sm font-semibold min-h-[140px]"
                  value={form.descricao}
                  onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                />
              ) : (
                <div className="mt-3 text-sm font-semibold text-slate-700 whitespace-pre-wrap min-h-[120px]">
                  {row.descricao || "Sem descrição detalhada."}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                <div className="text-[10px] font-black uppercase text-slate-500">
                  Observação da execução
                </div>
                <div className="mt-3 text-sm font-semibold text-slate-700 whitespace-pre-wrap min-h-[120px]">
                  {row.observacao_execucao || "Sem observação de execução."}
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                <div className="text-[10px] font-black uppercase text-slate-500">
                  Fechamento
                </div>
                <div className="mt-3 text-sm font-semibold text-slate-700 space-y-2">
                  <div>
                    <span className="font-black text-slate-900">Data execução:</span>{" "}
                    {formatDateTimeBR(row.data_execucao)}
                  </div>
                  <div>
                    <span className="font-black text-slate-900">Data fechamento:</span>{" "}
                    {formatDateTimeBR(row.data_fechamento)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <div className="text-[10px] font-black uppercase text-slate-500 flex items-center gap-2 mb-3">
              <FaImage />
              Evidência
            </div>

            {row.foto_url ? (
              <img
                src={row.foto_url}
                alt="Evidência"
                className="w-full h-80 object-cover rounded-2xl border bg-white"
              />
            ) : (
              <EmptyPhoto />
            )}
          </div>
        </div>
      </div>

      <PasswordModal
        open={showSenhaEditar}
        onClose={() => setShowSenhaEditar(false)}
        onConfirm={confirmarEditar}
        title="Autorizar edição"
        description="Digite sua senha para liberar a edição desta solicitação."
        confirmLabel="Liberar edição"
        loading={validandoSenha}
      />

      <PasswordModal
        open={showSenhaExcluir}
        onClose={() => setShowSenhaExcluir(false)}
        onConfirm={confirmarExcluir}
        title="Confirmar exclusão"
        description="Digite sua senha para excluir esta solicitação. A exclusão será lógica e ficará no histórico."
        confirmLabel="Excluir solicitação"
        loading={validandoSenha}
      />
    </div>
  );
}
