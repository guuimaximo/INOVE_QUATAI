import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../supabase";
import { AuthContext } from "../context/AuthContext";

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
    prazo_conclusao: "", // Novo campo
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
      <div className="mt-2">
        <span className="block text-sm text-gray-600 mb-2">{label}</span>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {arr.map((u, i) => {
            const pdf = isPdf(u);
            const img = !pdf && isImageUrl(u);

            return (
              <a
                key={`${u}-${i}`}
                href={u}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border bg-white p-2 hover:shadow-sm"
              >
                {img ? (
                  <img
                    src={u}
                    alt={fileNameFromUrl(u)}
                    className="h-24 w-full object-cover rounded"
                    loading="lazy"
                  />
                ) : (
                  <div className="h-24 flex items-center justify-center text-sm font-semibold text-gray-600">
                    {pdf ? "PDF" : "ARQ"}
                  </div>
                )}
                <div className="mt-2 text-xs text-blue-700 underline break-words">
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
      nav("/estrutura-fisica/central");
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
      nav("/estrutura-fisica/central");
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
      nav("/estrutura-fisica/central");
    } catch (e) {
      console.error(e);
      alert(`Erro: ${e?.message || String(e)}`);
    } finally {
      setLoading(false);
    }
  }

  if (!item) return <div className="p-6">Carregando...</div>;

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Baixa na Execução</h1>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
        <h2 className="text-lg font-semibold mb-3">Detalhes da Solicitação</h2>

        <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Item titulo="Nº Pedido" valor={item.numero_pedido || "-"} />
          <Item titulo="Nome do solicitante" valor={item.nome_solicitante || "-"} />
          <Item
            titulo="Data da solicitação"
            valor={
              item.data_solicitacao
                ? new Date(`${item.data_solicitacao}T00:00:00`).toLocaleDateString("pt-BR")
                : "-"
            }
          />
          <Item titulo="Setor" valor={item.setor || "-"} />
          <Item titulo="Responsável da área" valor={item.responsavel_area || "-"} />
          <Item titulo="Prioridade" valor={item.prioridade || "-"} />
          <Item
            titulo="Justificativa do impacto"
            valor={item.justificativa_impacto || "-"}
            className="md:col-span-2"
          />
          <Item
            titulo="Descrição da demanda"
            valor={item.descricao_demanda || "-"}
            className="md:col-span-2"
          />
          <div className="md:col-span-2">
            {renderListaArquivos(item.evidencias_abertura, "Evidências da abertura")}
          </div>
        </dl>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-4">
        <h2 className="text-lg font-semibold mb-3">Tratamento</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Quem vai realizar</label>
            <input
              className="w-full rounded-md border px-3 py-2"
              value={form.quem_vai_realizar}
              onChange={(e) => setForm({ ...form, quem_vai_realizar: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1">Valor gasto</label>
            <input
              className="w-full rounded-md border px-3 py-2"
              value={form.valor_gasto}
              onChange={(e) => setForm({ ...form, valor_gasto: e.target.value })}
              placeholder="0,00"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1">Status</label>
            <select
              className="w-full rounded-md border px-3 py-2"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              <option value="EM_ANALISE">EM_ANALISE</option>
              <option value="EM_ANDAMENTO">EM_ANDAMENTO</option>
            </select>
          </div>

          {form.status === "EM_ANDAMENTO" && (
            <div>
              <label className="block text-sm text-gray-600 mb-1">Prazo para conclusão</label>
              <input
                type="date"
                className="w-full rounded-md border px-3 py-2"
                value={form.prazo_conclusao}
                onChange={(e) => setForm({ ...form, prazo_conclusao: e.target.value })}
              />
            </div>
          )}

          <div className="md:col-span-2">
            <label className="block text-sm text-gray-600 mb-1">
              Comentários responsáveis estrutura física
            </label>
            <textarea
              rows={4}
              className="w-full rounded-md border px-3 py-2"
              value={form.comentarios_estrutura}
              onChange={(e) => setForm({ ...form, comentarios_estrutura: e.target.value })}
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm text-gray-700 font-medium mb-2">
              Evidências da execução
            </label>

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              className={[
                "w-full rounded-xl border-2 border-dashed transition cursor-pointer",
                "bg-gray-50 hover:bg-gray-100",
                isDragging ? "border-blue-500 bg-blue-50" : "border-gray-300",
              ].join(" ")}
              style={{ minHeight: 140 }}
            >
              <div className="h-full w-full flex flex-col items-center justify-center py-8 px-4 text-center">
                <p className="text-sm font-semibold text-gray-700">
                  Clique para enviar ou arraste e solte
                </p>
                <p className="text-xs text-gray-500 mt-1">PNG, JPG, MP4, MOV ou PDF</p>
              </div>

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
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                {files.map((f, idx) => (
                  <div
                    key={`${f.name}-${f.size}-${idx}`}
                    className="flex items-center justify-between rounded-lg border bg-white px-3 py-2 text-sm"
                  >
                    <span className="truncate">{f.name}</span>
                    <button
                      type="button"
                      onClick={() => removeFile(idx)}
                      className="ml-3 text-red-600 hover:underline shrink-0"
                    >
                      remover
                    </button>
                  </div>
                ))}
              </div>
            )}

            {renderListaArquivos(item.evidencias_execucao, "Evidências já lançadas")}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mt-6">
          <button
            onClick={salvarAndamento}
            disabled={loading}
            className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {loading ? "Salvando..." : "Salvar Edição"}
          </button>

          <button
            onClick={cancelar}
            disabled={loading}
            className="rounded-md bg-gray-700 px-4 py-2 text-white hover:bg-gray-800 disabled:opacity-60"
          >
            Cancelar Pedido
          </button>

          <button
            onClick={concluir}
            disabled={loading}
            className="rounded-md bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            Concluir Pedido
          </button>
        </div>
      </div>
    </div>
  );
}

function Item({ titulo, valor, className = "" }) {
  return (
    <div className={className}>
      <dt className="text-sm text-gray-500">{titulo}</dt>
      <dd className="font-medium whitespace-pre-wrap">{valor}</dd>
    </div>
  );
}
