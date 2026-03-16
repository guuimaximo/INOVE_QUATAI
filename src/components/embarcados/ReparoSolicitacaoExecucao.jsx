import { useEffect, useRef, useState, useContext } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../supabase";
import { AuthContext } from "../../context/AuthContext";
import { FaArrowLeft, FaSave, FaUpload, FaTrash } from "react-icons/fa";

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

function safeText(v) {
  const s = String(v ?? "").trim();
  return s || null;
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

function EmptyPhoto() {
  return (
    <div className="w-full h-48 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 flex items-center justify-center text-slate-400 text-sm font-bold">
      Sem evidência
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
  const [dragAtivo, setDragAtivo] = useState(false);

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
    foto_tipo: "",
    foto_nome: "",
  });

  const fileInputRef = useRef(null);

  useEffect(() => {
    async function carregarUsuarioSessao() {
      try {
        const loginSessao = safeText(user?.login || user?.email);
        const idSessao = pickUserUuid(user);

        let nomeSessao =
          buildNomeSobrenome(user) ||
          safeText(user?.nome) ||
          safeText(user?.nome_completo) ||
          null;

        if (!nomeSessao && loginSessao) {
          const { data: u } = await supabase
            .from("usuarios_aprovadores")
            .select("nome, sobrenome, nome_completo")
            .eq("login", loginSessao)
            .maybeSingle();

          if (u) {
            nomeSessao =
              safeText(u?.nome_completo) ||
              safeText([u?.nome, u?.sobrenome].filter(Boolean).join(" ")) ||
              safeText(u?.nome);
          }
        }

        setNomeUsuario(nomeSessao || loginSessao || "");
        setLoginUsuario(loginSessao || "");
        setUsuarioId(idSessao || null);
      } catch {
        setNomeUsuario(safeText(user?.login || user?.email) || "");
        setLoginUsuario(safeText(user?.login || user?.email) || "");
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
      foto_url: data?.foto_url || "",
      foto_tipo: data?.foto_url?.toLowerCase().includes(".pdf") ? "application/pdf" : "",
      foto_nome: "",
    }));

    setLoading(false);
  }

  useEffect(() => {
    carregar();
  }, [id, nomeUsuario]);

  useEffect(() => {
    function handlePaste(event) {
      const items = event.clipboardData?.items || [];
      if (!items.length) return;

      for (const item of items) {
        if (item.kind !== "file") continue;

        const file = item.getAsFile();
        if (file) {
          processarArquivo(file);
          event.preventDefault();
          break;
        }
      }
    }

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [row]);

  function validarArquivo(file) {
    if (!file) return false;

    const tiposPermitidos = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
      "application/pdf",
    ];

    if (!tiposPermitidos.includes(file.type)) {
      alert("Selecione uma imagem (JPG, PNG, WEBP) ou PDF.");
      return false;
    }

    return true;
  }

  async function uploadArquivo(file) {
    if (!file || !row?.id) return null;

    const nomeLimpo = sanitizeFileName(file.name);
    const ext = nomeLimpo.split(".").pop() || (file.type === "application/pdf" ? "pdf" : "jpg");
    const baseSemDuplicarExt = nomeLimpo.replace(/\.[^.]+$/, "");
    const filePath = `reparos/execucao/${row.id}/${Date.now()}_${baseSemDuplicarExt}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET_FOTOS)
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: true,
        contentType: file.type || undefined,
      });

    if (uploadError) {
      throw uploadError;
    }

    const { data } = supabase.storage.from(BUCKET_FOTOS).getPublicUrl(filePath);

    return {
      publicUrl: data?.publicUrl || "",
      tipo: file.type || "",
      nome: file.name || "",
    };
  }

  async function processarArquivo(file) {
    if (!validarArquivo(file) || !row?.id) return;

    try {
      setUploading(true);

      const uploaded = await uploadArquivo(file);

      setForm((prev) => ({
        ...prev,
        foto_url: uploaded?.publicUrl || "",
        foto_tipo: uploaded?.tipo || "",
        foto_nome: uploaded?.nome || "",
      }));
    } catch (e) {
      console.error(e);
      alert(e?.message || "Erro ao enviar evidência.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function handleUploadFoto(e) {
    const file = e.target.files?.[0] || null;
    if (!file) return;
    processarArquivo(file);
  }

  function removerArquivo() {
    setForm((prev) => ({
      ...prev,
      foto_url: "",
      foto_tipo: "",
      foto_nome: "",
    }));

    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    setDragAtivo(true);
  }

  function handleDragEnter(e) {
    e.preventDefault();
    e.stopPropagation();
    setDragAtivo(true);
  }

  function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();

    if (e.currentTarget.contains(e.relatedTarget)) return;
    setDragAtivo(false);
  }

  function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    setDragAtivo(false);

    const file = e.dataTransfer?.files?.[0] || null;
    if (!file) return;

    processarArquivo(file);
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
            acao_executada: safeText(form.acao_executada),
            diagnostico: safeText(form.diagnostico),
            observacao: safeText(form.observacao),
            executado_por: executadoPorFinal,
            foto_url: safeText(form.foto_url),
            criado_por_login: safeText(loginUsuario),
            criado_por_nome: safeText(nomeUsuario || loginUsuario),
            // criado_por_id: usuarioId || null,
          },
        ]);

      if (evError) {
        alert(evError.message || "Erro ao salvar evento.");
        return;
      }

      const updatePayload = {
        status: form.status_evento,
        observacao_execucao: safeText(form.observacao),
        executado_por: executadoPorFinal,
        data_execucao: new Date().toISOString(),
        foto_url: safeText(form.foto_url),
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
      navigate("/embarcados-reparos");
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

  const isPdf =
    form.foto_tipo === "application/pdf" ||
    String(form.foto_url || "").toLowerCase().includes(".pdf");

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
          <button
            onClick={() => navigate("/embarcados-reparos")}
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

            <div
              onDragEnter={handleDragEnter}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`rounded-2xl border-2 border-dashed p-4 transition ${
                dragAtivo
                  ? "border-emerald-500 bg-emerald-50"
                  : "border-slate-300 bg-slate-50"
              }`}
            >
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-3 items-start">
                <div>
                  {form.foto_url ? (
                    isPdf ? (
                      <div className="w-full h-48 rounded-2xl border border-slate-200 bg-white flex flex-col items-center justify-center text-slate-600 text-sm font-bold px-4 text-center">
                        <div>PDF anexado</div>
                        {form.foto_nome ? (
                          <div className="text-xs text-slate-500 mt-2 break-all">{form.foto_nome}</div>
                        ) : null}
                        <a
                          href={form.foto_url}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-3 text-blue-600 hover:text-blue-700 underline font-black"
                        >
                          Abrir PDF
                        </a>
                      </div>
                    ) : (
                      <img
                        src={form.foto_url}
                        alt="Evidência"
                        className="w-full h-48 object-cover rounded-2xl border bg-white"
                      />
                    )
                  ) : (
                    <EmptyPhoto />
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="px-4 py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-black flex items-center gap-2 disabled:opacity-60"
                  >
                    <FaUpload />
                    {uploading ? "Enviando..." : "Anexar arquivo"}
                  </button>

                  {form.foto_url ? (
                    <button
                      type="button"
                      onClick={removerArquivo}
                      disabled={uploading}
                      className="px-4 py-3 rounded-2xl bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 text-sm font-black flex items-center gap-2 disabled:opacity-60"
                    >
                      <FaTrash />
                      Remover
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="mt-3 text-xs font-semibold text-slate-500">
                Arraste e solte aqui, cole com Ctrl + V ou selecione um arquivo. Permitido: JPG, PNG, WEBP e PDF.
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp,application/pdf"
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
