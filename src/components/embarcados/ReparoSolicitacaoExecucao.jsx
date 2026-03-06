import { useEffect, useRef, useState, useContext } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../supabase";
import { AuthContext } from "../../context/AuthContext";
import { FaArrowLeft, FaSave, FaUpload } from "react-icons/fa";

const STATUS = ["ABERTA", "EM_ANALISE", "EM_EXECUCAO", "AG_PECAS", "CONCLUIDA", "CANCELADA"];
const BUCKET_FOTOS = "embarcados";

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

function sanitizeFileName(name) {
  return String(name || "arquivo")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w.\-]+/g, "_");
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
    default:
      return status || "-";
  }
}

function EmptyPhoto() {
  return (
    <div className="w-full h-48 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 flex items-center justify-center text-slate-400 text-sm font-bold">
      Sem foto
    </div>
  );
}

export default function ReparoSolicitacaoExecucao() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

  const [row, setRow] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [nomeUsuario, setNomeUsuario] = useState("");
  const [loginUsuario, setLoginUsuario] = useState("");
  const [usuarioId, setUsuarioId] = useState(null);

  const [form, setForm] = useState({
    status_evento: "EM_ANALISE",
    diagnostico: "",
    acao_executada: "",
    observacao: "",
    executado_por: "",
    foto_url: "",
  });

  const fileInputRef = useRef(null);

  useEffect(() => {
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

    carregarUsuarioSessao();
  }, [user]);

  async function carregar() {
    setLoading(true);

    const { data, error } = await supabase
      .from("embarcados_solicitacoes_reparo")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) console.error(error);

    setRow(data || null);
    setForm((prev) => ({
      ...prev,
      status_evento: data?.status || "EM_ANALISE",
      executado_por: nomeUsuario || "",
    }));

    setLoading(false);
  }

  useEffect(() => {
    carregar();
  }, [id, nomeUsuario]);

  async function handleUploadFoto(e) {
    const file = e.target.files?.[0];
    if (!file || !row?.id) return;

    try {
      setUploading(true);

      const nomeLimpo = sanitizeFileName(file.name);
      const ext = nomeLimpo.split(".").pop() || "jpg";
      const baseSemDuplicarExt = nomeLimpo.replace(/\.[^.]+$/, "");
      const filePath = `reparos/execucao/${row.id}/${Date.now()}_${baseSemDuplicarExt}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET_FOTOS)
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: true,
        });

      if (uploadError) {
        alert(uploadError.message || "Erro ao enviar foto.");
        return;
      }

      const { data } = supabase.storage.from(BUCKET_FOTOS).getPublicUrl(filePath);

      setForm((prev) => ({
        ...prev,
        foto_url: data?.publicUrl || "",
      }));
    } finally {
      setUploading(false);
      if (e.target) e.target.value = "";
    }
  }

  async function salvar() {
    if (!row?.id) return;
    if (!form.status_evento) return alert("Status é obrigatório.");

    try {
      setSaving(true);

      const executadoPorFinal = nomeUsuario || loginUsuario || null;

      const { error: evError } = await supabase
        .from("embarcados_solicitacoes_reparo_eventos")
        .insert([
          {
            solicitacao_id: row.id,
            status_evento: form.status_evento,
            acao_executada: form.acao_executada || null,
            diagnostico: form.diagnostico || null,
            observacao: form.observacao || null,
            executado_por: executadoPorFinal,
            foto_url: form.foto_url || null,
            criado_por_login: loginUsuario || null,
            criado_por_nome: nomeUsuario || loginUsuario || null,
            criado_por_id: usuarioId || null,
          },
        ]);

      if (evError) {
        alert(evError.message || "Erro ao salvar evento.");
        return;
      }

      const updatePayload = {
        status: form.status_evento,
        observacao_execucao: form.observacao || null,
        executado_por: executadoPorFinal,
        data_execucao: new Date().toISOString(),
      };

      if (form.status_evento === "CONCLUIDA" || form.status_evento === "CANCELADA") {
        updatePayload.data_fechamento = new Date().toISOString();
      }

      const { error: upError } = await supabase
        .from("embarcados_solicitacoes_reparo")
        .update(updatePayload)
        .eq("id", row.id);

      if (upError) {
        alert(upError.message || "Erro ao atualizar solicitação.");
        return;
      }

      alert("Execução salva com sucesso.");
      navigate("/embarcados/reparos");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="p-6 text-center font-black text-slate-500">Carregando execução...</div>;
  }

  if (!row) {
    return <div className="p-6 text-center font-black text-slate-500">Solicitação não encontrada.</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
          <button
            onClick={() => navigate("/embarcados/reparos")}
            className="mb-3 inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 text-sm font-black"
          >
            <FaArrowLeft />
            Voltar
          </button>

          <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
            Execução da solicitação
          </div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 mt-1">
            {row.problema}
          </h1>
          <p className="text-sm text-slate-500 font-semibold mt-1">
            {row.tipo_embarcado} • Veículo {row.veiculo || "-"}
          </p>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] font-black uppercase text-slate-500 mb-1 block">
              Novo status
            </label>
            <select
              className="w-full border border-slate-300 rounded-2xl px-3 py-3 text-sm font-bold bg-white"
              value={form.status_evento}
              onChange={(e) => setForm({ ...form, status_evento: e.target.value })}
            >
              {STATUS.map((s) => (
                <option key={s} value={s}>
                  {statusLabel(s)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] font-black uppercase text-slate-500 mb-1 block">
              Executado por
            </label>
            <input
              className="w-full border border-slate-300 rounded-2xl px-3 py-3 text-sm font-bold bg-slate-100"
              value={nomeUsuario || ""}
              disabled
            />
          </div>

          <div className="lg:col-span-2">
            <label className="text-[10px] font-black uppercase text-slate-500 mb-1 block">
              Diagnóstico
            </label>
            <textarea
              className="w-full border border-slate-300 rounded-2xl px-3 py-3 text-sm font-semibold min-h-[110px]"
              value={form.diagnostico}
              onChange={(e) => setForm({ ...form, diagnostico: e.target.value })}
            />
          </div>

          <div className="lg:col-span-2">
            <label className="text-[10px] font-black uppercase text-slate-500 mb-1 block">
              Ação executada
            </label>
            <textarea
              className="w-full border border-slate-300 rounded-2xl px-3 py-3 text-sm font-semibold min-h-[110px]"
              value={form.acao_executada}
              onChange={(e) => setForm({ ...form, acao_executada: e.target.value })}
            />
          </div>

          <div className="lg:col-span-2">
            <label className="text-[10px] font-black uppercase text-slate-500 mb-1 block">
              Observação
            </label>
            <textarea
              className="w-full border border-slate-300 rounded-2xl px-3 py-3 text-sm font-semibold min-h-[110px]"
              value={form.observacao}
              onChange={(e) => setForm({ ...form, observacao: e.target.value })}
            />
          </div>

          <div className="lg:col-span-2">
            <label className="text-[10px] font-black uppercase text-slate-500 mb-1 block">
              Evidência
            </label>

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-3 items-start">
              <div>
                {form.foto_url ? (
                  <img
                    src={form.foto_url}
                    alt="Evidência"
                    className="w-full h-48 object-cover rounded-2xl border bg-white"
                  />
                ) : (
                  <EmptyPhoto />
                )}
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="px-4 py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-black flex items-center gap-2 disabled:opacity-60"
                >
                  <FaUpload />
                  {uploading ? "Enviando..." : "Anexar foto"}
                </button>
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleUploadFoto}
            />
          </div>

          <div className="lg:col-span-2 pt-2 border-t border-slate-200 flex justify-end">
            <button
              onClick={salvar}
              disabled={saving || uploading}
              className="px-5 py-3 rounded-2xl bg-slate-900 hover:bg-black text-white font-black text-sm flex items-center gap-2 disabled:opacity-60"
            >
              <FaSave />
              {saving ? "Salvando..." : "Salvar execução"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
