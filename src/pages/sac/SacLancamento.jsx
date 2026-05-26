import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../supabase";
import CampoMotorista from "../../components/CampoMotorista";
import CampoPrefixo from "../../components/CampoPrefixo";
import { AuthContext } from "../../context/AuthContext";
import {
  SAC_ACOES,
  SAC_MOTIVOS,
  SAC_ORIGENS,
  nowHHMM,
  pickUserAudit,
  pickUserUuid,
  todayISO,
  uploadSacFiles,
} from "./SacCommon";

const initialForm = () => ({
  data_atendimento: todayISO(),
  hora_atendimento: nowHHMM(),
  origem: "WhatsApp",
  cliente_nome: "",
  cliente_telefone: "",
  carro_prefixo: "",
  linha: "",
  operador_chapa: "",
  operador_nome: "",
  grupo_motivo: "Reclamacao",
  subgrupo_motivo: "Intervalo de atendimento",
  data_ocorrencia: todayISO(),
  hora_ocorrencia: nowHHMM(),
  detalhamento: "",
  acao_tomada: "Registrado e esclarecido com passageiro",
  abrir_tratativa: false,
});

export default function SacLancamento() {
  const { user } = useContext(AuthContext);
  const [form, setForm] = useState(initialForm);
  const [operador, setOperador] = useState({ chapa: "", nome: "" });
  const [linhas, setLinhas] = useState([]);
  const [files, setFiles] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);
  const [saving, setSaving] = useState(false);

  const atendenteNome = useMemo(
    () => pickUserAudit(user).atendente_nome || "Usuario logado",
    [user]
  );
  const subgrupos = SAC_MOTIVOS[form.grupo_motivo] || [];

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
    supabase
      .from("linhas")
      .select("id, codigo, descricao")
      .order("codigo")
      .then(({ data }) => setLinhas(data || []));
  }, []);

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      operador_chapa: operador.chapa || "",
      operador_nome: operador.nome || "",
    }));
  }, [operador]);

  useEffect(() => {
    const abrirTratativa = form.acao_tomada === "Abrir tratativa";
    setForm((prev) =>
      prev.abrir_tratativa === abrirTratativa
        ? prev
        : { ...prev, abrir_tratativa: abrirTratativa }
    );
  }, [form.acao_tomada]);

  function usarAgora() {
    setForm((prev) => ({
      ...prev,
      data_atendimento: todayISO(),
      hora_atendimento: nowHHMM(),
      data_ocorrencia: todayISO(),
      hora_ocorrencia: nowHHMM(),
    }));
  }

  // ===== Evidências (mesmo padrão do SolicitacaoTratativa) =====
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
  const removeFile = (idx) =>
    setFiles((prev) => prev.filter((_, i) => i !== idx));

  const onPasteEvidencia = (e) => {
    try {
      const items = e.clipboardData?.items
        ? Array.from(e.clipboardData.items)
        : [];
      if (!items.length) return;
      const images = items
        .filter(
          (it) => it.kind === "file" && (it.type || "").startsWith("image/")
        )
        .map((it) => it.getAsFile())
        .filter((f) => f && f.size > 0);
      if (!images.length) return;
      e.preventDefault();
      const filesFromClipboard = images.map((f) => {
        const ext =
          f.type === "image/png"
            ? "png"
            : f.type === "image/jpeg"
            ? "jpg"
            : "img";
        const name = `print_${new Date().toISOString().replace(/[:.]/g, "-")}.${ext}`;
        return new File([f], name, {
          type: f.type,
          lastModified: Date.now(),
        });
      });
      addFiles(filesFromClipboard);
    } catch (err) {
      console.error("Erro ao colar evidência:", err);
    }
  };

  function buildDescricaoTratativa(protocolo = "SAC") {
    const operadorTexto =
      [form.operador_chapa, form.operador_nome].filter(Boolean).join(" - ") ||
      "Nao informado";
    return [
      `Origem SAC: ${protocolo}`,
      `Cliente: ${form.cliente_nome || "Nao informado"} | Telefone: ${
        form.cliente_telefone || "Nao informado"
      }`,
      `Veiculo: ${form.carro_prefixo || "Nao informado"} | Linha: ${
        form.linha || "Nao informada"
      }`,
      `Operador: ${operadorTexto}`,
      `Motivo: ${form.grupo_motivo} / ${form.subgrupo_motivo || "Sem subgrupo"}`,
      "",
      form.detalhamento,
    ].join("\n");
  }

  async function salvar() {
    if (!form.origem || !form.grupo_motivo || !form.detalhamento) {
      alert("Preencha origem, motivo e detalhamento.");
      return;
    }
    setSaving(true);
    try {
      const folder = `${form.data_atendimento}_${form.cliente_telefone || "sem-cliente"}_${Date.now()}`;
      const evidencias_urls = await uploadSacFiles(files, folder);
      const status = form.abrir_tratativa ? "Em tratativa" : "Registrado";
      let tratativaId = null;

      if (form.abrir_tratativa) {
        const { data: tratativa, error: erroTratativa } = await supabase
          .from("tratativas")
          .insert({
            motorista_chapa: form.operador_chapa || null,
            motorista_nome: form.operador_nome || null,
            tipo_ocorrencia: `SAC - ${form.grupo_motivo}`,
            prioridade: form.grupo_motivo === "Denuncia" ? "Alta" : "Media",
            setor_origem: "SAC",
            linha: form.linha || null,
            descricao: buildDescricaoTratativa("novo protocolo"),
            status: "Pendente",
            imagem_url: evidencias_urls[0] || null,
            evidencias_urls,
            data_ocorrido: form.data_ocorrencia || null,
            hora_ocorrido: form.hora_ocorrencia || null,
            criado_por_login: user?.login || user?.email || null,
            criado_por_nome: atendenteNome,
            criado_por_id: pickUserUuid(user),
          })
          .select("id")
          .single();
        if (erroTratativa) throw erroTratativa;
        tratativaId = tratativa?.id || null;
      }

      const { data, error } = await supabase
        .from("sac_atendimentos")
        .insert({
          ...form,
          status,
          tratativa_id: tratativaId,
          evidencias_urls,
          ...pickUserAudit(user),
        })
        .select("id, protocolo")
        .single();
      if (error) throw error;

      alert(`SAC ${data?.protocolo || ""} registrado com sucesso.`);
      setForm(initialForm());
      setOperador({ chapa: "", nome: "" });
      setFiles([]);
    } catch (error) {
      console.error(error);
      alert(`Erro ao salvar SAC: ${error?.message || error}`);
    } finally {
      setSaving(false);
    }
  }

  const camposObrigatoriosPreenchidos =
    form.origem && form.grupo_motivo && form.detalhamento;

  return (
    <div className="min-h-screen space-y-5 bg-slate-50 p-4 md:p-6 text-slate-800">
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="text-xs font-black uppercase tracking-[0.24em] text-violet-600">
          SAC
        </div>
        <h1 className="mt-3 text-3xl font-black text-slate-900">
          Lançamento de SAC
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Registre o atendimento, anexe evidencias e, se necessario, abra a
          tratativa automaticamente.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-2">
        <div>
          <label className="block text-sm text-gray-600 mb-1">Atendente</label>
          <input
            value={atendenteNome}
            disabled
            className="w-full rounded-2xl border border-slate-200 bg-slate-100 px-3 py-3 text-sm font-medium text-slate-600"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-600 mb-1">Origem</label>
          <select
            value={form.origem}
            onChange={(e) => setForm({ ...form, origem: e.target.value })}
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-medium text-slate-700 outline-none transition focus:border-violet-400 focus:bg-white"
          >
            {SAC_ORIGENS.map((origem) => (
              <option key={origem} value={origem}>
                {origem}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm text-gray-600 mb-1">
            Data do atendimento
          </label>
          <input
            type="date"
            value={form.data_atendimento}
            onChange={(e) =>
              setForm({ ...form, data_atendimento: e.target.value })
            }
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-medium text-slate-700 outline-none transition focus:border-violet-400 focus:bg-white"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-600 mb-1">
            Hora do atendimento
          </label>
          <input
            type="time"
            value={form.hora_atendimento}
            onChange={(e) =>
              setForm({ ...form, hora_atendimento: e.target.value })
            }
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-medium text-slate-700 outline-none transition focus:border-violet-400 focus:bg-white"
          />
        </div>

        <div className="md:col-span-2">
          <button
            type="button"
            onClick={usarAgora}
            className="rounded-2xl border border-slate-200 bg-slate-100 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200"
          >
            Usar data e hora atuais
          </button>
        </div>

        <div>
          <label className="block text-sm text-gray-600 mb-1">Cliente</label>
          <input
            value={form.cliente_nome}
            onChange={(e) =>
              setForm({ ...form, cliente_nome: e.target.value })
            }
            placeholder="Nome do cliente"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-medium text-slate-700 outline-none transition focus:border-violet-400 focus:bg-white"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-600 mb-1">Telefone</label>
          <input
            value={form.cliente_telefone}
            onChange={(e) =>
              setForm({ ...form, cliente_telefone: e.target.value })
            }
            placeholder="Telefone para reincidencia"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-medium text-slate-700 outline-none transition focus:border-violet-400 focus:bg-white"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-600 mb-1">
            Carro / Prefixo
          </label>
          <CampoPrefixo
            value={form.carro_prefixo}
            onChange={(value) => setForm({ ...form, carro_prefixo: value })}
            label=""
            placeholder="Digite o carro ou prefixo..."
          />
        </div>

        <div>
          <label className="block text-sm text-gray-600 mb-1">Linha</label>
          <select
            value={form.linha}
            onChange={(e) => setForm({ ...form, linha: e.target.value })}
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-medium text-slate-700 outline-none transition focus:border-violet-400 focus:bg-white"
          >
            <option value="">Selecione</option>
            {linhas.map((linha) => (
              <option key={linha.id} value={linha.codigo}>
                {linha.codigo} - {linha.descricao}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm text-gray-600 mb-1">Operador</label>
          <CampoMotorista value={operador} onChange={setOperador} label="" />
        </div>

        <div>
          <label className="block text-sm text-gray-600 mb-1">
            Grupo de motivo
          </label>
          <select
            value={form.grupo_motivo}
            onChange={(e) =>
              setForm({
                ...form,
                grupo_motivo: e.target.value,
                subgrupo_motivo: SAC_MOTIVOS[e.target.value]?.[0] || "",
              })
            }
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-medium text-slate-700 outline-none transition focus:border-violet-400 focus:bg-white"
          >
            {Object.keys(SAC_MOTIVOS).map((motivo) => (
              <option key={motivo} value={motivo}>
                {motivo}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm text-gray-600 mb-1">Subgrupo</label>
          <select
            value={form.subgrupo_motivo}
            onChange={(e) =>
              setForm({ ...form, subgrupo_motivo: e.target.value })
            }
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-medium text-slate-700 outline-none transition focus:border-violet-400 focus:bg-white"
          >
            {subgrupos.map((subgrupo) => (
              <option key={subgrupo} value={subgrupo}>
                {subgrupo}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm text-gray-600 mb-1">
            Data da ocorrencia
          </label>
          <input
            type="date"
            value={form.data_ocorrencia}
            onChange={(e) =>
              setForm({ ...form, data_ocorrencia: e.target.value })
            }
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-medium text-slate-700 outline-none transition focus:border-violet-400 focus:bg-white"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-600 mb-1">
            Hora da ocorrencia
          </label>
          <input
            type="time"
            value={form.hora_ocorrencia}
            onChange={(e) =>
              setForm({ ...form, hora_ocorrencia: e.target.value })
            }
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-medium text-slate-700 outline-none transition focus:border-violet-400 focus:bg-white"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm text-gray-600 mb-1">
            Acao tomada
          </label>
          <select
            value={form.acao_tomada}
            onChange={(e) =>
              setForm({ ...form, acao_tomada: e.target.value })
            }
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-medium text-slate-700 outline-none transition focus:border-violet-400 focus:bg-white"
          >
            {SAC_ACOES.map((acao) => (
              <option key={acao} value={acao}>
                {acao}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm text-gray-600 mb-1">
            Detalhamento
          </label>
          <textarea
            rows={6}
            value={form.detalhamento}
            onChange={(e) =>
              setForm({ ...form, detalhamento: e.target.value })
            }
            placeholder="Descreva o atendimento, a reclamacao, informacao ou denuncia."
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-medium text-slate-700 outline-none transition focus:border-violet-400 focus:bg-white"
          />
        </div>

        {/* =========================
            ✅ EVIDÊNCIAS (mesmo padrão do SolicitacaoTratativa)
        ========================== */}
        <div className="md:col-span-2">
          <label className="block text-sm text-gray-700 font-medium mb-2">
            Evidências (Fotos, Vídeos e PDF)
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
                "bg-slate-50 hover:bg-slate-100",
                "focus:outline-none focus:ring-2 focus:ring-violet-500",
                isDragging
                  ? "border-violet-500 bg-violet-50"
                  : "border-slate-300",
              ].join(" ")}
              style={{ minHeight: 150 }}
            >
              <div className="h-full w-full flex flex-col items-center justify-center py-8 cursor-pointer select-none px-4 text-center">
                <p className="text-sm font-semibold text-slate-700">
                  Clique para enviar{" "}
                  <span className="font-normal">ou arraste e solte</span>
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  PNG, JPG, MP4, MOV ou PDF
                </p>
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
              <div className="h-full rounded-2xl border border-slate-200 bg-white p-4">
                <div
                  tabIndex={0}
                  onPaste={onPasteEvidencia}
                  className={[
                    "rounded-lg border-2 border-dashed p-4",
                    "border-slate-300 bg-slate-50 text-slate-700",
                    "focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500",
                  ].join(" ")}
                >
                  <p className="text-sm">Clique aqui e cole seu print.</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Somente imagens do clipboard serão adicionadas.
                  </p>
                </div>

                <div className="mt-3 text-xs text-slate-500">
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
                <p className="text-sm font-medium text-slate-700">
                  Arquivos anexados
                </p>
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
                  const badge = isImg
                    ? "Imagem"
                    : isVid
                    ? "Vídeo"
                    : isPdf
                    ? "PDF"
                    : "Arquivo";

                  return (
                    <div
                      key={`${f.name}-${f.size}-${idx}`}
                      className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="rounded-full border border-slate-200 px-2 py-0.5 text-[11px] text-slate-600">
                            {badge}
                          </span>
                          <span className="text-[11px] text-slate-500">
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

      <div className="flex justify-end">
        <button
          onClick={salvar}
          disabled={saving || !camposObrigatoriosPreenchidos}
          className="rounded-2xl bg-violet-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-violet-700 disabled:opacity-60"
        >
          {saving ? "Salvando…" : "Criar"}
        </button>
      </div>
    </div>
  );
}
