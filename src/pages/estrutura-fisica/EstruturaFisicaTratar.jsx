import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../supabase";
import { AuthContext } from "../../context/AuthContext";
import {
  FaArrowLeft,
  FaTools,
  FaUser,
  FaBuilding,
  FaExclamationTriangle,
  FaInfoCircle,
  FaClipboardList,
  FaCalendarAlt,
  FaCheckCircle,
  FaBan,
  FaSave,
} from "react-icons/fa";

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

function buildNomeUsuario(u) {
  const nome = String(u?.nome || "").trim();
  const sobrenome = String(u?.sobrenome || "").trim();
  const nomeCompleto = String(u?.nome_completo || "").trim();

  if (nomeCompleto) return nomeCompleto;
  if (nome && sobrenome) return `${nome} ${sobrenome}`;
  if (nome) return nome;
  return null;
}

export default function TratarEstruturaFisica() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useContext(AuthContext);

  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    quem_vai_realizar: "",
    valor_gasto: "",
    comentarios_estrutura: "",
    status: "EM_ANALISE",
    prazo_conclusao: "",
  });

  const [files, setFiles] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  const acceptMime = useMemo(
    () => ["image/png", "image/jpeg", "image/jpg", "video/mp4", "video/quicktime", "application/pdf"],
    []
  );

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("estrutura_fisica_solicitacoes")
        .select("*")
        .eq("id", id)
        .single();

      if (error) {
        console.error(error);
        return;
      }

      setItem(data || null);
      setForm({
        quem_vai_realizar: data?.quem_vai_realizar || "",
        valor_gasto: data?.valor_gasto ?? "",
        comentarios_estrutura: data?.comentarios_estrutura || "",
        prazo_conclusao: data?.prazo_conclusao || "",
        status:
          data?.status === "EM_ANDAMENTO" || data?.status === "EM_ANALISE"
            ? data.status
            : "EM_ANALISE",
      });
    })();
  }, [id]);

  const keyFile = (f) => `${f.name}-${f.size}-${f.lastModified}`;

  const addFiles = (list) => {
    const incoming = Array.from(list || []);
    const filtered = incoming.filter((f) => acceptMime.includes(f.type));
    const existing = new Set(files.map(keyFile));
    const deduped = filtered.filter((f) => !existing.has(keyFile(f)));
    if (deduped.length > 0) setFiles((prev) => [...prev, ...deduped]);
  };

  const onPickFiles = (e) => addFiles(e.target.files || []);
  const onDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    addFiles(e.dataTransfer.files || []);
  };

  const removeFile = (idx) => setFiles((prev) => prev.filter((_, i) => i !== idx));

  const fileNameFromUrl = (u) => {
    try {
      const raw = String(u || "");
      const noHash = raw.split("#")[0];
      const noQuery = noHash.split("?")[0];
      const last = noQuery.split("/").filter(Boolean).pop() || "arquivo";
      return decodeURIComponent(last);
    } catch {
      return "arquivo";
    }
  };

  const isPdf = (fileOrUrl) => {
    if (!fileOrUrl) return false;
    if (typeof fileOrUrl === "string") return fileOrUrl.toLowerCase().includes(".pdf");
    return false;
  };

  const isImageUrl = (u) => {
    const s = String(u || "").toLowerCase();
    return /\.(png|jpe?g|gif|webp|bmp|svg)(\?|#|$)/.test(s);
  };

  const renderListaArquivos = (urls, label) => {
    const arr = Array.isArray(urls) ? urls.filter(Boolean) : [];
    if (arr.length === 0) return null;

    return (
      <div className="mt-4 pt-4 border-t border-slate-100">
        <span className="block text-sm font-semibold text-slate-700 mb-3">{label}</span>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {arr.map((u, i) => {
            const pdf = isPdf(u);
            const img = !pdf && isImageUrl(u);

            return (
              <a
                key={`${u}-${i}`}
                href={u}
                target="_blank"
                rel="noopener noreferrer"
                className="group rounded-xl border border-slate-200 bg-slate-50 p-2 hover:shadow-md hover:border-blue-300 transition-all flex flex-col"
              >
                {img ? (
                  <img
                    src={u}
                    alt={fileNameFromUrl(u)}
                    className="h-24 w-full object-cover rounded-lg border border-slate-200"
                    loading="lazy"
                  />
                ) : (
                  <div className="h-24 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-sm font-bold text-slate-400 group-hover:text-blue-500 transition-colors">
                    {pdf ? "PDF" : "ARQ"}
                  </div>
                )}
                <div className="mt-2 text-xs text-slate-600 font-medium truncate group-hover:text-blue-600 transition-colors">
                  {fileNameFromUrl(u)}
                </div>
              </a>
            );
          })}
        </div>
      </div>
    );
  };

  async function uploadExecucao(numeroPedido) {
    const urls = [];

    for (const f of files) {
      const safeName = (f.name || "arquivo")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, "_")
        .replace(/[^a-zA-Z0-9._-]/g, "");

      const unique = `${Date.now()}_${Math.random().toString(16).slice(2)}_${safeName}`;
      const path = `execucao/${numeroPedido}/${unique}`;

      const up = await supabase.storage.from("estrutura_fisica").upload(path, f, {
        upsert: false,
        contentType: f.type || undefined,
      });

      if (up.error) throw up.error;

      const { data: pub } = supabase.storage.from("estrutura_fisica").getPublicUrl(path);
      if (pub?.publicUrl) urls.push(pub.publicUrl);
    }

    return urls;
  }

  async function salvarHistorico({ acao, statusFinal, evidenciasNovas }) {
    const realizadoPorNome = buildNomeUsuario(user) || user?.login || user?.email || "Usuário";
    const realizadoPorLogin = user?.login || user?.email || null;
    const realizadoPorId = pickUserUuid(user);

    const { error } = await supabase.from("estrutura_fisica_historico").insert({
      solicitacao_id: item.id,
      acao,
      status_aplicado: statusFinal,
      quem_vai_realizar: form.quem_vai_realizar || null,
      valor_gasto:
        form.valor_gasto !== "" && form.valor_gasto != null
          ? Number(String(form.valor_gasto).replace(",", "."))
          : null,
      comentarios_estrutura: form.comentarios_estrutura || null,
      prazo_conclusao: form.status === "EM_ANDAMENTO" ? (form.prazo_conclusao || null) : null,
      evidencias_execucao: evidenciasNovas || [],
      realizado_por_nome: realizadoPorNome,
      realizado_por_login: realizadoPorLogin,
      realizado_por_id: realizadoPorId,
    });

    if (error) throw error;
  }

  async function salvarAndamento() {
    if (!item) return;

    setLoading(true);
    try {
      const novas = files.length ? await uploadExecucao(item.numero_pedido) : [];
      const existentes = Array.isArray(item.evidencias_execucao) ? item.evidencias_execucao : [];
      const evidencias = [...existentes, ...novas];

      const { error } = await supabase
        .from("estrutura_fisica_solicitacoes")
        .update({
          quem_vai_realizar: form.quem_vai_realizar || null,
          valor_gasto:
            form.valor_gasto !== "" && form.valor_gasto != null
              ? Number(String(form.valor_gasto).replace(",", "."))
              : null,
          comentarios_estrutura: form.comentarios_estrutura || null,
          prazo_conclusao: form.status === "EM_ANDAMENTO" ? (form.prazo_conclusao || null) : null,
          evidencias_execucao: evidencias,
          status: form.status,
        })
        .eq("id", item.id);

      if (error) throw error;

      await salvarHistorico({
        acao: "ANDAMENTO",
        statusFinal: form.status,
        evidenciasNovas: novas,
      });

      alert("Edição salva com sucesso!");
      nav(-1);
    } catch (e) {
      console.error(e);
      alert(`Erro: ${e?.message || String(e)}`);
    } finally {
      setLoading(false);
    }
  }

  async function concluir() {
    if (!item) return;
    if (!form.comentarios_estrutura?.trim()) {
      alert("Preencha os comentários antes de concluir.");
      return;
    }

    setLoading(true);
    try {
      const novas = files.length ? await uploadExecucao(item.numero_pedido) : [];
      const existentes = Array.isArray(item.evidencias_execucao) ? item.evidencias_execucao : [];
      const evidencias = [...existentes, ...novas];

      const concluidoPorNome = buildNomeUsuario(user) || user?.login || user?.email || "Usuário";
      const concluidoPorLogin = user?.login || user?.email || null;
      const concluidoPorId = pickUserUuid(user);

      const { error } = await supabase
        .from("estrutura_fisica_solicitacoes")
        .update({
          quem_vai_realizar: form.quem_vai_realizar || null,
          valor_gasto:
            form.valor_gasto !== "" && form.valor_gasto != null
              ? Number(String(form.valor_gasto).replace(",", "."))
              : null,
          comentarios_estrutura: form.comentarios_estrutura || null,
          prazo_conclusao: form.status === "EM_ANDAMENTO" ? (form.prazo_conclusao || null) : null,
          evidencias_execucao: evidencias,
          status: "CONCLUIDO",
          concluido_em: new Date().toISOString(),
          concluido_por_nome: concluidoPorNome,
          concluido_por_login: concluidoPorLogin,
          concluido_por_id: concluidoPorId,
        })
        .eq("id", item.id);

      if (error) throw error;

      await salvarHistorico({
        acao: "CONCLUSAO",
        statusFinal: "CONCLUIDO",
        evidenciasNovas: novas,
      });

      alert("Pedido concluído com sucesso!");
      nav(-1);
    } catch (e) {
      console.error(e);
      alert(`Erro: ${e?.message || String(e)}`);
    } finally {
      setLoading(false);
    }
  }

  async function cancelar() {
    if (!item) return;
    if (!form.comentarios_estrutura?.trim()) {
      alert("Preencha os comentários para justificar o cancelamento.");
      return;
    }

    setLoading(true);
    try {
      const novas = files.length ? await uploadExecucao(item.numero_pedido) : [];
      const existentes = Array.isArray(item.evidencias_execucao) ? item.evidencias_execucao : [];
      const evidencias = [...existentes, ...novas];

      const canceladoPorNome = buildNomeUsuario(user) || user?.login || user?.email || "Usuário";
      const canceladoPorLogin = user?.login || user?.email || null;
      const canceladoPorId = pickUserUuid(user);

      const { error } = await supabase
        .from("estrutura_fisica_solicitacoes")
        .update({
          quem_vai_realizar: form.quem_vai_realizar || null,
          valor_gasto:
            form.valor_gasto !== "" && form.valor_gasto != null
              ? Number(String(form.valor_gasto).replace(",", "."))
              : null,
          comentarios_estrutura: form.comentarios_estrutura || null,
          evidencias_execucao: evidencias,
          status: "CANCELADO",
          cancelado_em: new Date().toISOString(),
          cancelado_por_nome: canceladoPorNome,
          cancelado_por_login: canceladoPorLogin,
          cancelado_por_id: canceladoPorId,
        })
        .eq("id", item.id);

      if (error) throw error;

      await salvarHistorico({
        acao: "CANCELAMENTO",
        statusFinal: "CANCELADO",
        evidenciasNovas: novas,
      });

      alert("Pedido cancelado com sucesso!");
      nav(-1);
    } catch (e) {
      console.error(e);
      alert(`Erro: ${e?.message || String(e)}`);
    } finally {
      setLoading(false);
    }
  }

  if (!item) return <div className="p-8 text-center text-slate-500 font-medium">Carregando informações...</div>;

  const inputClass = "w-full rounded-xl border border-slate-300 bg-slate-50/50 px-4 py-2.5 text-sm text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all";
  const labelClass = "block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2";

  const dataSolic = item.data_solicitacao
    ? new Date(`${item.data_solicitacao}T00:00:00`).toLocaleDateString("pt-BR")
    : "-";
  const prazoEstimado = item.prazo_estimado
    ? new Date(`${item.prazo_estimado}T00:00:00`).toLocaleDateString("pt-BR")
    : "-";

  return (
    <div className="min-h-screen space-y-5 bg-slate-50 p-4 md:p-6 text-slate-800">
      {/* Hero */}
      <div className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:flex-row md:items-end md:justify-between">
        <div className="space-y-3">
          <button
            onClick={() => nav(-1)}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            <FaArrowLeft />
            Voltar
          </button>

          <div>
            <div className="text-xs font-black uppercase tracking-[0.24em] text-orange-600">
              Estrutura Física
            </div>
            <h1 className="mt-3 flex items-center gap-3 text-3xl font-black text-slate-900">
              <span className="rounded-2xl bg-orange-50 p-3 text-orange-600 shadow-sm">
                <FaTools />
              </span>
              Tratar Solicitação
              <span className="text-sm font-mono font-bold bg-slate-100 text-slate-500 px-2 py-1 rounded border border-slate-200 align-middle">
                #{item.numero_pedido || item.id}
              </span>
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Revise os dados, registre a execução e dê baixa na solicitação.
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700 self-end">
          <div><span className="font-semibold">Solicitante:</span> {item.nome_solicitante || "-"}</div>
          <div className="mt-1"><span className="font-semibold">Data:</span> {dataSolic}</div>
        </div>
      </div>

      {/* Cards resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <ResumoCard
          titulo="Solicitante"
          valor={item.nome_solicitante || "-"}
          subtitulo={item.setor || "-"}
          icon={<FaUser className="text-3xl text-blue-100" />}
          border="border-l-blue-500"
        />
        <ResumoCard
          titulo="Prioridade"
          valor={item.prioridade || "-"}
          subtitulo={`Prazo: ${prazoEstimado}`}
          icon={<FaExclamationTriangle className="text-3xl text-amber-100" />}
          border="border-l-amber-500"
        />
        <ResumoCard
          titulo="Status"
          valor={item.status || "-"}
          subtitulo={item.responsavel_area || "-"}
          icon={<FaInfoCircle className="text-3xl text-orange-100" />}
          border="border-l-orange-500"
        />
        <ResumoCard
          titulo="Data da solicitação"
          valor={dataSolic}
          subtitulo={`Pedido #${item.numero_pedido || "-"}`}
          icon={<FaCalendarAlt className="text-3xl text-emerald-100" />}
          border="border-l-emerald-500"
        />
      </div>

      {/* Detalhes */}
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <FaClipboardList className="text-slate-500" />
          <h2 className="text-lg font-bold text-slate-800">Detalhes da Solicitação</h2>
        </div>

          <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <Item titulo="Nº Pedido" valor={item.numero_pedido || "-"} />
            <Item titulo="Nome do solicitante" valor={item.nome_solicitante || "-"} />
            <Item
              titulo="Data da solicitação"
              valor={item.data_solicitacao ? new Date(`${item.data_solicitacao}T00:00:00`).toLocaleDateString("pt-BR") : "-"}
            />
            <Item titulo="Setor" valor={item.setor || "-"} />
            <Item titulo="Responsável da área" valor={item.responsavel_area || "-"} />
            <Item titulo="Prioridade" valor={item.prioridade || "-"} />
            <Item titulo="Justificativa do impacto" valor={item.justificativa_impacto || "-"} className="sm:col-span-2 lg:col-span-3" />
            <Item titulo="Descrição da demanda" valor={item.descricao_demanda || "-"} className="sm:col-span-2 lg:col-span-3" />
            <div className="sm:col-span-2 lg:col-span-3">
              {renderListaArquivos(item.evidencias_abertura, "Evidências da abertura")}
            </div>
          </dl>
        </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <FaTools className="text-orange-500" />
          <h2 className="text-lg font-bold text-slate-800">Tratamento e Execução</h2>
        </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className={labelClass}>Quem vai realizar</label>
              <input
                className={inputClass}
                value={form.quem_vai_realizar}
                placeholder="Nome do executor..."
                onChange={(e) => setForm({ ...form, quem_vai_realizar: e.target.value })}
              />
            </div>

            <div>
              <label className={labelClass}>Valor gasto (R$)</label>
              <input
                className={inputClass}
                value={form.valor_gasto}
                onChange={(e) => setForm({ ...form, valor_gasto: e.target.value })}
                placeholder="0,00"
              />
            </div>

            <div>
              <label className={labelClass}>Status</label>
              <select
                className={inputClass}
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                <option value="EM_ANALISE">EM ANÁLISE</option>
                <option value="EM_ANDAMENTO">EM ANDAMENTO</option>
              </select>
            </div>

            {form.status === "EM_ANDAMENTO" && (
              <div>
                <label className={labelClass}>Prazo para conclusão</label>
                <input
                  type="date"
                  className={inputClass}
                  value={form.prazo_conclusao}
                  onChange={(e) => setForm({ ...form, prazo_conclusao: e.target.value })}
                />
              </div>
            )}

            <div className="sm:col-span-2">
              <label className={labelClass}>Comentários da estrutura física</label>
              <textarea
                rows={4}
                placeholder="Detalhes sobre a execução, justificativas..."
                className={`${inputClass} resize-y`}
                value={form.comentarios_estrutura}
                onChange={(e) => setForm({ ...form, comentarios_estrutura: e.target.value })}
              />
            </div>

            <div className="sm:col-span-2">
              <label className={labelClass}>Evidências da execução</label>

              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
                className={[
                  "w-full rounded-2xl border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center p-8 text-center",
                  isDragging 
                    ? "border-blue-400 bg-blue-50/50 scale-[1.01]" 
                    : "border-slate-300 bg-slate-50 hover:bg-slate-100 hover:border-slate-400",
                ].join(" ")}
                style={{ minHeight: 160 }}
              >
                <div className="p-3 bg-white rounded-full shadow-sm mb-3 text-slate-400">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
                </div>
                <p className="text-sm font-bold text-slate-700">Clique ou arraste arquivos aqui</p>
                <p className="text-xs text-slate-500 mt-1">Suporta imagens (PNG, JPG), vídeos (MP4) e PDF</p>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,video/mp4,video/quicktime,application/pdf"
                  multiple
                  className="hidden"
                  onChange={onPickFiles}
                />
              </div>

              {files.length > 0 && (
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {files.map((f, idx) => (
                    <div
                      key={`${f.name}-${f.size}-${idx}`}
                      className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm"
                    >
                      <span className="truncate font-medium text-slate-700">{f.name}</span>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); removeFile(idx); }}
                        className="ml-3 p-1 text-red-500 hover:bg-red-50 hover:text-red-700 rounded-md transition-colors shrink-0"
                        title="Remover arquivo"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {renderListaArquivos(item.evidencias_execucao, "Evidências já lançadas")}
            </div>
          </div>

        <div className="mt-6 pt-5 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-end gap-3">
          <button
            onClick={cancelar}
            disabled={loading}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-2xl border border-red-200 bg-white px-5 py-2.5 text-sm font-bold text-red-600 hover:bg-red-50 hover:border-red-300 disabled:opacity-60 transition"
          >
            <FaBan /> Cancelar Pedido
          </button>

          <button
            onClick={salvarAndamento}
            disabled={loading}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60 transition"
          >
            <FaSave /> {loading ? "Salvando..." : "Salvar Edição"}
          </button>

          <button
            onClick={concluir}
            disabled={loading}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60 transition"
          >
            <FaCheckCircle /> Concluir Pedido
          </button>
        </div>
      </div>
    </div>
  );
}

function ResumoCard({ titulo, valor, subtitulo, icon, border }) {
  const tone =
    border?.includes("blue")
      ? "from-blue-50 to-cyan-50 border-blue-200"
      : border?.includes("amber")
      ? "from-amber-50 to-orange-50 border-amber-200"
      : border?.includes("orange")
      ? "from-orange-50 to-amber-50 border-orange-200"
      : border?.includes("emerald")
      ? "from-emerald-50 to-teal-50 border-emerald-200"
      : "from-slate-50 to-gray-50 border-slate-200";

  return (
    <div className={`min-h-[124px] rounded-3xl border bg-gradient-to-br p-4 shadow-sm ${tone}`}>
      <div className="flex h-full items-start justify-between gap-3">
        <div className="flex h-full min-w-0 flex-col justify-between">
          <p className="text-xs font-black uppercase tracking-[0.18em] opacity-80">{titulo}</p>
          <div className="mt-2">
            <p className="text-xl font-black text-slate-900 truncate">{valor}</p>
            {subtitulo && (
              <p className="mt-1 text-xs font-semibold text-slate-500 truncate">{subtitulo}</p>
            )}
          </div>
        </div>
        <div className="opacity-80 shrink-0">{icon}</div>
      </div>
    </div>
  );
}

function Item({ titulo, valor, className = "" }) {
  return (
    <div className={className}>
      <dt className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{titulo}</dt>
      <dd className="text-sm font-semibold text-slate-800 whitespace-pre-wrap">{valor}</dd>
    </div>
  );
}
