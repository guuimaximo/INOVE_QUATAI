import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { FaCopy } from "react-icons/fa";
import { supabase } from "../../supabase";
import CampoMotorista from "../../components/CampoMotorista";
import CampoPrefixo from "../../components/CampoPrefixo";
import { AuthContext } from "../../context/AuthContext";
import {
  buildMensagemWhatsApp,
  copyToClipboard,
  pickUserAudit,
  SITUACOES_OPERACIONAIS,
  todayISO,
  nowHHMM,
  uploadAcidenteFiles,
} from "./AcidentesCommon";

const initialForm = () => ({
  data_ocorrencia: todayISO(),
  hora_ocorrencia: nowHHMM(),
  local: "",
  linha: "",
  prefixo: "",
  motorista_chapa: "",
  motorista_nome: "",
  tipo_acidente: "Colisão com terceiro",
  veiculo_terceiro: "",
  placa_terceiro: "",
  condutor_terceiro: "",
  telefone_terceiro: "",
  descricao: "",
  situacao_operacional: "Seguiu viagem",
  precisa_imagens: true,
  dano_coletivo: false,
  dano_terceiro: true,
  registros_observacao: "Segue fotos mandadas pelo Operador",
});

export default function AcidentesLancamento() {
  const { user } = useContext(AuthContext);
  const [form, setForm] = useState(initialForm);
  const [motorista, setMotorista] = useState({ chapa: "", nome: "" });
  const [linhas, setLinhas] = useState([]);
  const [files, setFiles] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);
  const [saving, setSaving] = useState(false);

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
      .then(({ data, error }) => {
        if (error) {
          console.warn("Erro ao carregar linhas:", error);
          setLinhas([]);
          return;
        }
        setLinhas(data || []);
      });
  }, []);

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      motorista_chapa: motorista.chapa || "",
      motorista_nome: motorista.nome || "",
    }));
  }, [motorista]);

  const mensagemWhatsApp = useMemo(() => buildMensagemWhatsApp(form), [form]);

  function setAgora() {
    setForm((prev) => ({
      ...prev,
      data_ocorrencia: todayISO(),
      hora_ocorrencia: nowHHMM(),
    }));
  }

  async function copiarMensagem() {
    await copyToClipboard(mensagemWhatsApp);
    alert("Mensagem copiada para o WhatsApp.");
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

  async function salvarOcorrencia() {
    if (!form.local || !form.prefixo || !form.descricao) {
      alert("Preencha local, prefixo e descrição.");
      return;
    }

    setSaving(true);
    try {
      const status = form.precisa_imagens ? "Aguardando imagens" : "Em aberto";
      const folder = `${form.data_ocorrencia}_${form.prefixo || "sem-prefixo"}_${Date.now()}`;
      const evidencias_urls = await uploadAcidenteFiles(files, folder);

      const payload = {
        ...form,
        status,
        mensagem_whatsapp: mensagemWhatsApp,
        evidencias_urls,
        ...pickUserAudit(user),
      };

      const { data, error } = await supabase
        .from("acidentes_ocorrencias")
        .insert(payload)
        .select("id, numero_ocorrencia")
        .single();
      if (error) throw error;

      alert(`Ocorrência ${data?.numero_ocorrencia || ""} registrada com sucesso.`);
      setForm(initialForm());
      setMotorista({ chapa: "", nome: "" });
      setFiles([]);
    } catch (error) {
      console.error(error);
      alert(`Erro ao salvar acidente: ${error?.message || error}`);
    } finally {
      setSaving(false);
    }
  }

  const camposObrigatoriosPreenchidos =
    form.local && form.prefixo && form.descricao;

  return (
    <div className="min-h-screen space-y-5 bg-slate-50 p-4 md:p-6 text-slate-800">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="text-xs font-black uppercase tracking-[0.24em] text-violet-600">
          Acidentes
        </div>
        <h1 className="mt-3 text-3xl font-black text-slate-900">
          Lançamento de Acidente
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Abra a ocorrência, anexe evidências e copie a mensagem para o
          WhatsApp.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-2">
        <div>
          <label className="block text-sm text-gray-600 mb-1">Data</label>
          <input
            type="date"
            value={form.data_ocorrencia}
            onChange={(e) =>
              setForm({ ...form, data_ocorrencia: e.target.value })
            }
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-medium text-slate-700 outline-none transition focus:border-violet-400 focus:bg-white"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-600 mb-1">Hora</label>
          <input
            type="time"
            value={form.hora_ocorrencia}
            onChange={(e) =>
              setForm({ ...form, hora_ocorrencia: e.target.value })
            }
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-medium text-slate-700 outline-none transition focus:border-violet-400 focus:bg-white"
          />
        </div>

        <div className="md:col-span-2">
          <button
            type="button"
            onClick={setAgora}
            className="rounded-lg border border-slate-200 bg-slate-100 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200"
          >
            Usar data e hora atuais
          </button>
        </div>

        <div>
          <label className="block text-sm text-gray-600 mb-1">Linha</label>
          <select
            value={form.linha}
            onChange={(e) => setForm({ ...form, linha: e.target.value })}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-medium text-slate-700 outline-none transition focus:border-violet-400 focus:bg-white"
          >
            <option value="">Selecione</option>
            {linhas.map((linha) => (
              <option key={linha.id} value={linha.codigo}>
                {linha.codigo} - {linha.descricao}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm text-gray-600 mb-1">
            Carro / Prefixo
          </label>
          <CampoPrefixo
            value={form.prefixo}
            onChange={(value) => setForm({ ...form, prefixo: value })}
            label=""
            placeholder="Digite o carro ou prefixo..."
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm text-gray-600 mb-1">Motorista</label>
          <CampoMotorista value={motorista} onChange={setMotorista} label="" />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm text-gray-600 mb-1">Local</label>
          <input
            value={form.local}
            onChange={(e) => setForm({ ...form, local: e.target.value })}
            placeholder="Ex: Av. Itaquaquecetuba"
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-medium text-slate-700 outline-none transition focus:border-violet-400 focus:bg-white"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-600 mb-1">
            Tipo de acidente
          </label>
          <input
            value={form.tipo_acidente}
            onChange={(e) =>
              setForm({ ...form, tipo_acidente: e.target.value })
            }
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-medium text-slate-700 outline-none transition focus:border-violet-400 focus:bg-white"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-600 mb-1">
            Veículo terceiro
          </label>
          <input
            value={form.veiculo_terceiro}
            onChange={(e) =>
              setForm({ ...form, veiculo_terceiro: e.target.value })
            }
            placeholder="Sandero Branco"
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-medium text-slate-700 outline-none transition focus:border-violet-400 focus:bg-white"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-600 mb-1">Placa</label>
          <input
            value={form.placa_terceiro}
            onChange={(e) =>
              setForm({
                ...form,
                placa_terceiro: e.target.value.toUpperCase(),
              })
            }
            placeholder="SEC3111"
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-medium uppercase text-slate-700 outline-none transition focus:border-violet-400 focus:bg-white"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-600 mb-1">Condutor</label>
          <input
            value={form.condutor_terceiro}
            onChange={(e) =>
              setForm({ ...form, condutor_terceiro: e.target.value })
            }
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-medium text-slate-700 outline-none transition focus:border-violet-400 focus:bg-white"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm text-gray-600 mb-1">
            Telefone terceiro
          </label>
          <input
            value={form.telefone_terceiro}
            onChange={(e) =>
              setForm({ ...form, telefone_terceiro: e.target.value })
            }
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-medium text-slate-700 outline-none transition focus:border-violet-400 focus:bg-white"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm text-gray-600 mb-1">Descrição</label>
          <textarea
            rows={5}
            value={form.descricao}
            onChange={(e) => setForm({ ...form, descricao: e.target.value })}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-medium text-slate-700 outline-none transition focus:border-violet-400 focus:bg-white"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm text-gray-600 mb-1">
            Situação operacional
          </label>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {SITUACOES_OPERACIONAIS.map((situacao) => (
              <button
                key={situacao}
                type="button"
                onClick={() =>
                  setForm({ ...form, situacao_operacional: situacao })
                }
                className={`rounded-lg border px-4 py-3 text-sm font-bold transition ${
                  form.situacao_operacional === situacao
                    ? "border-violet-300 bg-violet-50 text-violet-700"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {situacao}
              </button>
            ))}
          </div>
        </div>

        <label className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
          <input
            type="checkbox"
            checked={form.precisa_imagens}
            onChange={(e) =>
              setForm({ ...form, precisa_imagens: e.target.checked })
            }
          />
          Precisa análise de imagens
        </label>
        <label className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700">
          <input
            type="checkbox"
            checked={form.dano_coletivo}
            onChange={(e) =>
              setForm({ ...form, dano_coletivo: e.target.checked })
            }
          />
          Dano no coletivo
        </label>
        <label className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700">
          <input
            type="checkbox"
            checked={form.dano_terceiro}
            onChange={(e) =>
              setForm({ ...form, dano_terceiro: e.target.checked })
            }
          />
          Dano no terceiro
        </label>

        <div className="md:col-span-2">
          <label className="block text-sm text-gray-600 mb-1">
            Observação dos registros
          </label>
          <input
            value={form.registros_observacao}
            onChange={(e) =>
              setForm({ ...form, registros_observacao: e.target.value })
            }
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-medium text-slate-700 outline-none transition focus:border-violet-400 focus:bg-white"
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
              <div className="h-full rounded-lg border border-slate-200 bg-white p-4">
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
                      className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
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

        {/* Mensagem WhatsApp (preview + copiar) */}
        <div className="md:col-span-2">
          <label className="block text-sm text-gray-700 font-medium mb-2">
            Mensagem para o WhatsApp
          </label>
          <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-950 p-4 text-xs font-semibold leading-relaxed text-white">
            {mensagemWhatsApp}
          </pre>
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              onClick={copiarMensagem}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
            >
              <FaCopy /> Copiar mensagem
            </button>
          </div>
          <p className="mt-2 text-xs font-semibold text-slate-500">
            Status automático ao salvar:{" "}
            {form.precisa_imagens ? "Aguardando imagens" : "Em aberto"}.
          </p>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={salvarOcorrencia}
          disabled={saving || !camposObrigatoriosPreenchidos}
          className="rounded-lg bg-violet-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-violet-700 disabled:opacity-60"
        >
          {saving ? "Salvando…" : "Criar"}
        </button>
      </div>
    </div>
  );
}
