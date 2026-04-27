import { useState, useEffect, useRef, useMemo, useContext } from "react";
import { supabase } from "../../supabase";
import CampoMotorista from "../../components/CampoMotorista";
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

function buildNomeSobrenome(u) {
  const nome = String(u?.nome || "").trim();
  const sobrenome = String(u?.sobrenome || "").trim();
  const nomeCompleto = String(u?.nome_completo || "").trim();

  if (nomeCompleto) return nomeCompleto;
  if (nome && sobrenome) return `${nome} ${sobrenome}`;
  if (nome) return nome;
  return null;
}

export default function SolicitacaoTratativa() {
  const { user } = useContext(AuthContext);

  const [motorista, setMotorista] = useState({ chapa: "", nome: "" });
  const [form, setForm] = useState({
    tipo_ocorrencia: "",
    prioridade: "",
    setor_origem: "",
    linha: "",
    descricao: "",
    data_ocorrida: "",
    hora_ocorrida: "",
  });

  const [files, setFiles] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);
  const [loading, setLoading] = useState(false);

  const [tiposOcorrencia, setTiposOcorrencia] = useState([]);
  const [setores, setSetores] = useState([]);
  const [linhas, setLinhas] = useState([]);

  const camposObrigatoriosPreenchidos =
    (motorista.chapa || motorista.nome) &&
    form.tipo_ocorrencia &&
    form.setor_origem &&
    form.prioridade &&
    form.descricao;

  // Aceita PNG/JPG, MP4/MOV, PDF
  const acceptMime = useMemo(
    () => [
      "image/png",
      "image/jpeg",
      "video/mp4",
      "video/quicktime",
      "application/pdf",
    ],
    []
  );

  useEffect(() => {
    async function carregarListas() {
      try {
        const [
          { data: tipos, error: e1 },
          { data: setoresData, error: e2 },
          { data: linhasData, error: e3 },
        ] = await Promise.all([
          supabase.from("tipos_ocorrencia").select("id, nome").order("nome"),
          supabase.from("setores").select("id, nome").order("nome"),
          supabase.from("linhas").select("id, codigo, descricao").order("codigo"),
        ]);

        if (e1 || e2 || e3) {
          console.error("Erro carregando listas:", e1 || e2 || e3);
        }

        setTiposOcorrencia(Array.isArray(tipos) ? tipos : []);
        setSetores(Array.isArray(setoresData) ? setoresData : []);
        setLinhas(Array.isArray(linhasData) ? linhasData : []);
      } catch (err) {
        console.error("Falha geral ao carregar listas:", err);
      }
    }
    carregarListas();
  }, []);

  // Chave para deduplicar corretamente
  const keyFile = (f) => `${f.name}-${f.size}-${f.lastModified}`;

  const addFiles = (list) => {
    const incoming = Array.from(list || []);
    const filtered = incoming.filter((f) => acceptMime.includes(f.type));

    const existing = new Set(files.map(keyFile));
    const deduped = filtered.filter((f) => !existing.has(keyFile(f)));

    if (deduped.length > 0) {
      setFiles((prev) => [...prev, ...deduped]);
    }
  };

  const onPickFiles = (e) => addFiles(e.target.files || []);
  const onDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    addFiles(e.dataTransfer.files || []);
  };

  const removeFile = (idx) =>
    setFiles((prev) => prev.filter((_, i) => i !== idx));

  // ✅ CTRL+V (print do clipboard) vira evidência
  const onPasteEvidencia = (e) => {
    try {
      const items = e.clipboardData?.items
        ? Array.from(e.clipboardData.items)
        : [];
      if (!items.length) return;

      const images = items
        .filter((it) => it.kind === "file" && (it.type || "").startsWith("image/"))
        .map((it) => it.getAsFile())
        .filter((f) => f && f.size > 0);

      if (!images.length) return;

      // evita colar texto dentro do dropzone/campo e só pega as imagens
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

  async function salvar() {
    if (!camposObrigatoriosPreenchidos) {
      alert("Preencha motorista, tipo de ocorrência, setor de origem e descrição.");
      return;
    }

    setLoading(true);

    try {
      // ✅ Auditoria: login/nome/id (UUID seguro)
      const loginSessao = user?.login || user?.email || null;
      const criadoPorId = pickUserUuid(user);

      // tenta montar nome completo (sem quebrar compatibilidade)
      let nomeSessao =
        buildNomeSobrenome(user) ||
        (user?.nome ? String(user.nome).trim() : null) ||
        (user?.nome_completo ? String(user.nome_completo).trim() : null) ||
        null;

      // fallback: busca no usuarios_aprovadores
      if (!nomeSessao && loginSessao) {
        const { data: u, error: eu } = await supabase
          .from("usuarios_aprovadores")
          .select("nome, sobrenome, nome_completo")
          .eq("login", loginSessao)
          .maybeSingle();

        if (!eu) {
          nomeSessao =
            u?.nome_completo ||
            [u?.nome, u?.sobrenome].filter(Boolean).join(" ") ||
            u?.nome ||
            null;
        }
      }

      let evidenciasUrls = [];

      if (files.length > 0) {
        // NÃO coloque "tratativas/" aqui (isso é o bucket)
        const folder = `${Date.now()}_${(motorista.chapa || motorista.nome || "sem_motorista")
          .toString()
          .trim()
          .replace(/\s+/g, "_")}`;

        for (const f of files) {
          // sanitiza nome do arquivo
          const safeName = (f.name || "arquivo")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "") // remove acentos
            .replace(/\s+/g, "_") // espaços -> _
            .replace(/[^a-zA-Z0-9._-]/g, ""); // remove caracteres inválidos

          // garante unicidade para não colidir
          const unique = `${Date.now()}_${Math.random().toString(16).slice(2)}_${safeName}`;
          const path = `${folder}/${unique}`; // <-- key correta (sem "tratativas/")

          const up = await supabase.storage.from("tratativas").upload(path, f, {
            upsert: false,
            contentType: f.type || undefined,
          });
          if (up.error) throw up.error;

          const { data: pub } = supabase.storage.from("tratativas").getPublicUrl(path);
          if (pub?.publicUrl) evidenciasUrls.push(pub.publicUrl);
        }
      }

      const payload = {
        motorista_chapa: motorista.chapa || null,
        motorista_nome: motorista.nome || null,
        tipo_ocorrencia: form.tipo_ocorrencia,
        prioridade: form.prioridade, // ✅ inclui "Gravíssima"
        setor_origem: form.setor_origem,
        linha: form.linha || null, // ✅ pode ser "NA" (Não se aplica)
        descricao: form.descricao,
        status: "Pendente",

        // compatibilidade legado
        imagem_url: evidenciasUrls[0] || null,

        // NOVO: guarda TODAS as evidências (jsonb)
        evidencias_urls: evidenciasUrls,

        data_ocorrido: form.data_ocorrida || null,
        hora_ocorrido: form.hora_ocorrida || null,

        // ✅ auditoria do criador
        criado_por_login: loginSessao,
        criado_por_nome: nomeSessao || loginSessao,
        criado_por_id: criadoPorId, // ✅ só UUID válido (senão null)
      };

      const { error } = await supabase.from("tratativas").insert(payload);
      if (error) throw error;

      alert("Solicitação registrada com sucesso!");
      setMotorista({ chapa: "", nome: "" });
      setForm({
        tipo_ocorrencia: "",
        prioridade: "",
        setor_origem: "",
        linha: "",
        descricao: "",
        data_ocorrida: "",
        hora_ocorrida: "",
      });
      setFiles([]);
    } catch (e) {
      console.error(e);
      alert(`Erro: ${e?.message || e?.toString?.() || String(e)}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="text-2xl font-bold mb-4">Solicitar Tratativa</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white p-4 rounded-lg shadow-sm">
        <CampoMotorista value={motorista} onChange={setMotorista} />

        <div>
          <label className="block text-sm text-gray-600 mb-1">Tipo de Ocorrência</label>
          <select
            className="w-full rounded-md border px-3 py-2"
            value={form.tipo_ocorrencia}
            onChange={(e) => setForm({ ...form, tipo_ocorrencia: e.target.value })}
          >
            <option value="">Selecione...</option>
            <option value="Colisão">Colisão</option>
            {tiposOcorrencia.map((t) => (
              <option key={t.id} value={t.nome}>
                {t.nome}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm text-gray-600 mb-1">Setor de Origem</label>
          <select
            className="w-full rounded-md border px-3 py-2"
            value={form.setor_origem}
            onChange={(e) => setForm({ ...form, setor_origem: e.target.value })}
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
          <label className="block text-sm text-gray-600 mb-1">Linha</label>
          <select
            className="w-full rounded-md border px-3 py-2"
            value={form.linha}
            onChange={(e) => setForm({ ...form, linha: e.target.value })}
          >
            <option value="">Selecione</option>

            {/* ✅ “Não se aplica” */}
            <option value="NA">— Não se aplica</option>

            {linhas.map((l) => (
              <option key={l.id} value={l.codigo}>
                {l.codigo} - {l.descricao}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm text-gray-600 mb-1">Prioridade</label>
          <select
            className="w-full rounded-md border px-3 py-2"
            value={form.prioridade}
            onChange={(e) => setForm({ ...form, prioridade: e.target.value })}
          >
            <option value="">Selecione...</option>
            <option value="Baixa">Baixa</option>
            <option value="Média">Média</option>
            <option value="Alta">Alta</option>
            <option value="Gravíssima">Gravíssima</option>
          </select>
        </div>

        <div>
          <label className="block text-sm text-gray-600 mb-1">Data do ocorrido</label>
          <input
            type="date"
            className="w-full rounded-md border px-3 py-2"
            value={form.data_ocorrida}
            onChange={(e) => setForm({ ...form, data_ocorrida: e.target.value })}
          />
        </div>

        <div>
          <label className="block text-sm text-gray-600 mb-1">Hora do ocorrido</label>
          <input
            type="time"
            className="w-full rounded-md border px-3 py-2"
            value={form.hora_ocorrida}
            onChange={(e) => setForm({ ...form, hora_ocorrida: e.target.value })}
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm text-gray-600 mb-1">Descrição</label>
          <textarea
            rows={4}
            className="w-full rounded-md border px-3 py-2"
            value={form.descricao}
            onChange={(e) => setForm({ ...form, descricao: e.target.value })}
          />
        </div>

        {/* =========================
            ✅ EVIDÊNCIAS (Layout melhorado + CTRL+V)
        ========================== */}
        <div className="md:col-span-2">
          <label className="block text-sm text-gray-700 font-medium mb-2">
            Evidências (Fotos, Vídeos e PDF)
          </label>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {/* ✅ DROPZONE */}
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
                  Clique para enviar{" "}
                  <span className="font-normal">ou arraste e solte</span>
                </p>
                <p className="text-xs text-gray-500 mt-1">PNG, JPG, MP4, MOV ou PDF</p>

                <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs text-gray-600 border">                 
                </div>
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

            {/* ✅ CAMPO EXPLÍCITO CTRL+V */}
            <div className="w-full">
              <div className="rounded-xl border bg-white p-4 h-full">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">                    
                      
                    </p>
                    <p className="text-xs text-gray-500 mt-1">                     
                    </p>
                  </div>

                  <span className="text-[11px] text-gray-500 border rounded-full px-2 py-1">                   
                  </span>
                </div>

                <div
                  tabIndex={0}
                  onPaste={onPasteEvidencia}
                  className={[
                    "mt-3 rounded-lg border-2 border-dashed p-4",
                    "bg-gray-50 text-gray-700",
                    "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500",
                  ].join(" ")}
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

          {/* ✅ LISTA DE ARQUIVOS (rica) */}
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
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFile(idx);
                        }}
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
          disabled={loading || !camposObrigatoriosPreenchidos}
          className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {loading ? "Salvando…" : "Criar"}
        </button>
      </div>
    </div>
  );
}
