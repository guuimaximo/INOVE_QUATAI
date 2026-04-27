import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../supabase";
import { AuthContext } from "../../context/AuthContext";

function isValidUUID(v) {
  if (!v) return false;
  const s = String(v).trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    s
  );
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

const RESPONSAVEIS_AREA = ["Guilherme", "Fernando", "Larissa"];

const PRIORIDADES = [
  { value: "URGENTE", label: "Urgente", prazoDias: 5 },
  { value: "ALTA", label: "Alta", prazoDias: 10 },
  { value: "MEDIA", label: "Média", prazoDias: 20 },
  { value: "BAIXA", label: "Baixa", prazoDias: 30 },
];

function addDaysToDate(dateStr, days) {
  const dt = new Date(`${dateStr}T00:00:00`);
  dt.setDate(dt.getDate() + Number(days || 0));
  return dt.toISOString().slice(0, 10);
}

export default function EstruturaFisicaSolicitacao() {
  const { user } = useContext(AuthContext);

  const [form, setForm] = useState({
    setor: "",
    responsavel_area: "",
    descricao_demanda: "",
    prioridade: "",
    justificativa_impacto: "",
  });

  const [setores, setSetores] = useState([]);
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [numeroPreview, setNumeroPreview] = useState("-");
  const fileInputRef = useRef(null);

  const acceptMime = useMemo(
    () => [
      "image/png",
      "image/jpeg",
      "image/jpg",
      "video/mp4",
      "video/quicktime",
      "application/pdf",
    ],
    []
  );

  useEffect(() => {
    carregarProximoNumero();
    carregarSetores();
  }, []);

  async function carregarSetores() {
    try {
      const { data, error } = await supabase
        .from("setores")
        .select("id, nome")
        .order("nome", { ascending: true });

      if (error) throw error;
      setSetores(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Erro ao carregar setores:", e);
      setSetores([]);
    }
  }

  async function carregarProximoNumero() {
    try {
      const { data, error } = await supabase
        .from("estrutura_fisica_solicitacoes")
        .select("numero_pedido")
        .order("numero_pedido", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      setNumeroPreview(Number(data?.numero_pedido || 0) + 1);
    } catch (e) {
      console.error("Erro ao carregar próximo número:", e);
      setNumeroPreview("-");
    }
  }

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

  const removeFile = (idx) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const onPasteEvidencia = (e) => {
    try {
      const items = e.clipboardData?.items ? Array.from(e.clipboardData.items) : [];
      if (!items.length) return;

      const images = items
        .filter((it) => it.kind === "file" && (it.type || "").startsWith("image/"))
        .map((it) => it.getAsFile())
        .filter((f) => f && f.size > 0);

      if (!images.length) return;
      e.preventDefault();

      const filesFromClipboard = images.map((f) => {
        const ext =
          f.type === "image/png" ? "png" : f.type === "image/jpeg" ? "jpg" : "img";
        const name = `print_${new Date().toISOString().replace(/[:.]/g, "-")}.${ext}`;
        return new File([f], name, { type: f.type, lastModified: Date.now() });
      });

      addFiles(filesFromClipboard);
    } catch (err) {
      console.error("Erro ao colar evidência:", err);
    }
  };

  const nomeSolicitante =
    buildNomeUsuario(user) || user?.login || user?.email || "Usuário";

  const loginSolicitante = user?.login || user?.email || null;
  const solicitanteId = pickUserUuid(user);

  const prioridadeSelecionada = PRIORIDADES.find((p) => p.value === form.prioridade);
  const prazoPreview = prioridadeSelecionada
    ? addDaysToDate(new Date().toISOString().slice(0, 10), prioridadeSelecionada.prazoDias)
    : "";

  const camposObrigatorios =
    form.setor &&
    form.responsavel_area &&
    form.descricao_demanda &&
    form.prioridade &&
    (form.prioridade !== "URGENTE" || form.justificativa_impacto.trim());

  async function salvar() {
    if (!camposObrigatorios) {
      alert("Preencha os campos obrigatórios.");
      return;
    }

    setLoading(true);
    try {
      const dataSolicitacao = new Date().toISOString().slice(0, 10);
      const prazoEstimado = prioridadeSelecionada
        ? addDaysToDate(dataSolicitacao, prioridadeSelecionada.prazoDias)
        : null;

      const { data: inserted, error: insErr } = await supabase
        .from("estrutura_fisica_solicitacoes")
        .insert({
          nome_solicitante: nomeSolicitante,
          solicitante_login: loginSolicitante,
          solicitante_id: solicitanteId,
          data_solicitacao: dataSolicitacao,
          setor: form.setor,
          responsavel_area: form.responsavel_area,
          descricao_demanda: form.descricao_demanda,
          prioridade: form.prioridade,
          justificativa_impacto:
            form.prioridade === "URGENTE" ? form.justificativa_impacto : null,
          prazo_estimado: prazoEstimado,
          status: "PENDENTE",
          evidencias_abertura: [],
        })
        .select("id, numero_pedido")
        .single();

      if (insErr) throw insErr;

      let evidencias = [];

      if (files.length > 0) {
        for (const f of files) {
          const safeName = (f.name || "arquivo")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/\s+/g, "_")
            .replace(/[^a-zA-Z0-9._-]/g, "");

          const unique = `${Date.now()}_${Math.random().toString(16).slice(2)}_${safeName}`;
          const path = `abertura/${inserted.numero_pedido}/${unique}`;

          const up = await supabase.storage.from("estrutura_fisica").upload(path, f, {
            upsert: false,
            contentType: f.type || undefined,
          });

          if (up.error) throw up.error;

          const { data: pub } = supabase.storage
            .from("estrutura_fisica")
            .getPublicUrl(path);

          if (pub?.publicUrl) evidencias.push(pub.publicUrl);
        }

        const { error: updErr } = await supabase
          .from("estrutura_fisica_solicitacoes")
          .update({ evidencias_abertura: evidencias })
          .eq("id", inserted.id);

        if (updErr) throw updErr;
      }

      alert(`Solicitação criada com sucesso! Nº Pedido: ${inserted.numero_pedido}`);

      setForm({
        setor: "",
        responsavel_area: "",
        descricao_demanda: "",
        prioridade: "",
        justificativa_impacto: "",
      });
      setFiles([]);
      carregarProximoNumero();
    } catch (e) {
      console.error(e);
      alert(`Erro: ${e?.message || String(e)}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl p-6">
      <h1 className="text-2xl font-bold mb-4">Lançar Controle Manutenção Estrutura Física</h1>

      <div className="bg-white p-4 rounded-lg shadow-sm grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-gray-600 mb-1">Nº Pedido</label>
          <input
            className="w-full rounded-md border px-3 py-2 bg-gray-100"
            value={numeroPreview}
            disabled
          />
        </div>

        <div>
          <label className="block text-sm text-gray-600 mb-1">Nome do solicitante</label>
          <input
            className="w-full rounded-md border px-3 py-2 bg-gray-100"
            value={nomeSolicitante}
            disabled
          />
        </div>

        <div>
          <label className="block text-sm text-gray-600 mb-1">Data da solicitação</label>
          <input
            className="w-full rounded-md border px-3 py-2 bg-gray-100"
            value={new Date().toLocaleDateString("pt-BR")}
            disabled
          />
        </div>

        <div>
          <label className="block text-sm text-gray-600 mb-1">Setor</label>
          <select
            className="w-full rounded-md border px-3 py-2 bg-white"
            value={form.setor}
            onChange={(e) => setForm({ ...form, setor: e.target.value })}
          >
            <option value="">Selecione...</option>
            {setores.map((s) => (
              <option key={s.id} value={s.nome}>
                {s.nome}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm text-gray-600 mb-1">Responsável da área</label>
          <select
            className="w-full rounded-md border px-3 py-2 bg-white"
            value={form.responsavel_area}
            onChange={(e) => setForm({ ...form, responsavel_area: e.target.value })}
          >
            <option value="">Selecione...</option>
            {RESPONSAVEIS_AREA.map((nome) => (
              <option key={nome} value={nome}>
                {nome}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm text-gray-600 mb-1">Prioridade</label>
          <select
            className="w-full rounded-md border px-3 py-2 bg-white"
            value={form.prioridade}
            onChange={(e) => setForm({ ...form, prioridade: e.target.value })}
          >
            <option value="">Selecione...</option>
            {PRIORIDADES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label} - {p.prazoDias} dias
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm text-gray-600 mb-1">Prazo estimado</label>
          <input
            className="w-full rounded-md border px-3 py-2 bg-gray-100"
            value={
              prazoPreview
                ? new Date(`${prazoPreview}T00:00:00`).toLocaleDateString("pt-BR")
                : ""
            }
            disabled
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm text-gray-600 mb-1">Descreva qual a demanda</label>
          <textarea
            rows={4}
            className="w-full rounded-md border px-3 py-2"
            value={form.descricao_demanda}
            onChange={(e) => setForm({ ...form, descricao_demanda: e.target.value })}
          />
        </div>

        {form.prioridade === "URGENTE" && (
          <div className="md:col-span-2">
            <label className="block text-sm text-gray-600 mb-1">
              Justificativa do impacto
            </label>
            <textarea
              rows={3}
              className="w-full rounded-md border px-3 py-2"
              value={form.justificativa_impacto}
              onChange={(e) => setForm({ ...form, justificativa_impacto: e.target.value })}
            />
          </div>
        )}

        <div className="md:col-span-2">
          <label className="block text-sm text-gray-700 font-medium mb-2">
            Evidências da abertura
          </label>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div
              tabIndex={0}
              onPaste={onPasteEvidencia}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              className={[
                "w-full rounded-xl border-2 border-dashed transition",
                "bg-gray-50 hover:bg-gray-100",
                "focus:outline-none focus:ring-2 focus:ring-blue-500",
                isDragging ? "border-blue-500 bg-blue-50" : "border-gray-300",
              ].join(" ")}
              style={{ minHeight: 150 }}
            >
              <div className="h-full w-full flex flex-col items-center justify-center py-8 cursor-pointer select-none px-4 text-center">
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

            <div className="w-full">
              <div className="rounded-xl border bg-white p-4 h-full">
                <div
                  tabIndex={0}
                  onPaste={onPasteEvidencia}
                  className="mt-3 rounded-lg border-2 border-dashed p-4 bg-gray-50 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <p className="text-sm">Clique aqui e cole seu print.</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Somente imagens do clipboard serão adicionadas.
                  </p>
                </div>

                <div className="mt-3 text-xs text-gray-500">
                  {files.length > 0 ? (
                    <span>
                      <b>{files.length}</b> evidência(s) anexada(s)
                    </span>
                  ) : (
                    <span>Nenhuma evidência anexada ainda</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {files.length > 0 && (
            <div className="mt-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-700">Arquivos anexados</p>
                <button
                  type="button"
                  className="text-xs text-red-600 hover:underline"
                  onClick={() => setFiles([])}
                >
                  remover tudo
                </button>
              </div>

              <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                {files.map((f, idx) => {
                  const isImg = (f.type || "").startsWith("image/");
                  const isVid = (f.type || "").startsWith("video/");
                  const isPdf = f.type === "application/pdf";
                  const badge = isImg ? "Imagem" : isVid ? "Vídeo" : isPdf ? "PDF" : "Arquivo";

                  return (
                    <div
                      key={`${f.name}-${f.size}-${idx}`}
                      className="flex items-center justify-between rounded-lg border bg-white px-3 py-2 text-sm"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] rounded-full border px-2 py-0.5 text-gray-600">
                            {badge}
                          </span>
                          <span className="text-[11px] text-gray-500">
                            {Math.round(f.size / 1024)} KB
                          </span>
                        </div>

                        <div className="truncate mt-1">
                          <span className="font-medium">{f.name}</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => removeFile(idx)}
                        className="ml-3 text-red-600 hover:underline shrink-0"
                      >
                        remover
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mt-4">
        <button
          onClick={salvar}
          disabled={loading || !camposObrigatorios}
          className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {loading ? "Salvando..." : "Criar"}
        </button>
      </div>
    </div>
  );
}
