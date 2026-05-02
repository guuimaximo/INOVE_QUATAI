import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { AuthContext } from "../../context/AuthContext";
import CampoPrefixo from "../../components/CampoPrefixo";
import { supabase } from "../../supabase";
import {
  FaCamera,
  FaCheckCircle,
  FaClipboardList,
  FaIdCard,
  FaPlus,
  FaSave,
  FaTimes,
} from "react-icons/fa";

const BUCKET_FOTOS = "pcm_troca_pneus";

const POSICOES = [
  "DIANTEIRO DIREITO",
  "DIANTEIRO ESQUERDO",
  "TRASEIRO INTERNO DIREITO",
  "TRASEIRO INTERNO ESQUERDO",
  "TRASEIRO EXTERNO DIREITO",
  "TRASEIRO EXTERNO ESQUERDO",
];

const EMPTY_FORM = {
  prefixo: "",
  ficha: "",
  posicao: POSICOES[0],
  numeroFogo: "",
  observacoes: "",
};

function safeText(value) {
  const text = String(value ?? "").trim();
  return text || null;
}

function sanitizeFileName(value) {
  return String(value || "arquivo")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w.\-]+/g, "_");
}

function createClientUuid() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function formatDate(value) {
  if (!value) return "-";

  try {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function extractFichaSequence(value) {
  const digits = String(value || "").match(/(\d+)$/);
  return digits ? Number.parseInt(digits[1], 10) : 0;
}

function buildNextFicha(rows) {
  const maxValue = (rows || []).reduce((max, row) => {
    const current = extractFichaSequence(row?.ficha_troca);
    return current > max ? current : max;
  }, 0);

  return `TP-${String(maxValue + 1).padStart(6, "0")}`;
}

async function uploadFotoNumeroFogo(trocaId, file) {
  const safeName = sanitizeFileName(file?.name);
  const path = `trocas/${trocaId}/numero_fogo_${Date.now()}_${safeName}`;

  const { error: uploadError } = await supabase.storage.from(BUCKET_FOTOS).upload(path, file, {
    upsert: false,
    contentType: file?.type || undefined,
    cacheControl: "3600",
  });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from(BUCKET_FOTOS).getPublicUrl(path);
  return {
    path,
    url: data?.publicUrl || "",
  };
}

function PhotoCaptureCard({ file, inputRef, onChange }) {
  const previewUrl = useMemo(() => {
    if (!file) return "";
    return URL.createObjectURL(file);
  }, [file]);

  return (
    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-900">Foto do numero de fogo</div>
          <div className="mt-1 text-xs leading-5 text-slate-500">
            Ao tocar em inserir foto, a camera abre no celular.
          </div>
        </div>
        {file ? (
          <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
            Capturada
          </span>
        ) : null}
      </div>

      <div className="mt-4 overflow-hidden rounded-3xl border border-dashed border-slate-300 bg-white">
        {previewUrl ? (
          <img src={previewUrl} alt="Numero de fogo" className="h-52 w-full object-cover" />
        ) : (
          <div className="flex h-52 flex-col items-center justify-center gap-3 px-6 text-center text-slate-400">
            <FaCamera className="text-2xl" />
            <div className="text-sm font-medium">Nenhuma foto adicionada</div>
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={onChange}
      />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-sm"
      >
        <FaCamera />
        Inserir foto
      </button>
    </div>
  );
}

function FichaCard({ ficha }) {
  return (
    <article className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
            <FaClipboardList />
            {ficha.ficha_troca}
          </div>
          <h3 className="mt-3 text-lg font-semibold text-slate-950">Prefixo {ficha.prefixo}</h3>
          <p className="mt-1 text-sm text-slate-500">{ficha.posicao}</p>
        </div>

        <div className="text-sm text-slate-500 md:text-right">
          <div className="font-semibold text-slate-900">{formatDate(ficha.created_at)}</div>
          <div className="mt-1">{ficha.criado_por_nome || ficha.criado_por_login || "Equipe PCM"}</div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">
            Numero de fogo
          </div>
          <div className="mt-2 text-sm font-medium text-slate-800">
            {ficha.numero_fogo_pneu || ficha.pneu_colocado_descricao || "-"}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">
            Status
          </div>
          <div className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-emerald-700">
            <FaCheckCircle />
            Registrada
          </div>
        </div>
      </div>

      {ficha.observacoes ? (
        <div className="mt-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
          {ficha.observacoes}
        </div>
      ) : null}
    </article>
  );
}

function NovaFichaModal({
  open,
  form,
  foto,
  saving,
  inputRef,
  onClose,
  onPrefixoChange,
  onFieldChange,
  onPhotoChange,
  onSubmit,
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-[28px] border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">
              PCM · Solicitação
            </div>
            <h2 className="mt-1 text-xl font-semibold text-slate-950">Lancar troca de pneus</h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <FaTimes />
          </button>
        </div>

        <div className="space-y-5 px-5 py-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <CampoPrefixo
                value={form.prefixo}
                onChange={onPrefixoChange}
                label="Prefixo"
              />
            </div>

            <label className="flex flex-col gap-2">
              <span className="text-sm text-gray-600">Numero da ficha</span>
              <input
                type="text"
                value={form.ficha}
                disabled
                className="w-full rounded-md border border-gray-300 bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-2">
              <span className="text-sm text-gray-600">Posicao do pneu</span>
              <select
                value={form.posicao}
                onChange={(event) => onFieldChange("posicao", event.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-semibold text-slate-800"
              >
                {POSICOES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm text-gray-600">Numero de fogo do pneu</span>
              <input
                type="text"
                value={form.numeroFogo}
                onChange={(event) => onFieldChange("numeroFogo", event.target.value)}
                placeholder="Digite o numero de fogo"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-semibold text-slate-800"
              />
            </label>
          </div>

          <PhotoCaptureCard
            file={foto}
            inputRef={inputRef}
            onChange={onPhotoChange}
          />

          <label className="flex flex-col gap-2">
            <span className="text-sm text-gray-600">Observacoes</span>
            <textarea
              value={form.observacoes}
              onChange={(event) => onFieldChange("observacoes", event.target.value)}
              rows={3}
              placeholder="Se precisar, escreva uma observacao curta."
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-semibold text-slate-800"
            />
          </label>
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-200 px-5 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
          >
            <FaSave />
            {saving ? "Salvando..." : "Salvar ficha"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PCMTrocaPneus() {
  const { user } = useContext(AuthContext);
  const [form, setForm] = useState(EMPTY_FORM);
  const [fotoNumeroFogo, setFotoNumeroFogo] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loadingList, setLoadingList] = useState(true);
  const [lastSavedId, setLastSavedId] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [fichas, setFichas] = useState([]);

  const fotoNumeroFogoRef = useRef(null);

  function resetFormState(nextFicha) {
    setForm({
      ...EMPTY_FORM,
      ficha: nextFicha || "",
    });
    setFotoNumeroFogo(null);
    if (fotoNumeroFogoRef.current) fotoNumeroFogoRef.current.value = "";
  }

  async function loadFichas() {
    try {
      setLoadingList(true);
      const { data, error } = await supabase
        .from("pcm_troca_pneus")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(30);

      if (error) throw error;
      setFichas(data || []);
      return data || [];
    } catch (error) {
      console.error("Erro ao carregar fichas de troca de pneus:", error);
      alert(error?.message || "Nao foi possivel carregar a central de fichas.");
      return [];
    } finally {
      setLoadingList(false);
    }
  }

  useEffect(() => {
    loadFichas();
  }, []);

  async function abrirNovaFicha() {
    const rows = fichas.length ? fichas : await loadFichas();
    const nextFicha = buildNextFicha(rows);
    resetFormState(nextFicha);
    setLastSavedId("");
    setModalOpen(true);
  }

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSalvarFicha() {
    const prefixo = safeText(form.prefixo);
    const ficha = safeText(form.ficha);
    const numeroFogo = safeText(form.numeroFogo);
    const observacoes = safeText(form.observacoes);

    if (!prefixo || !ficha || !numeroFogo) {
      alert("Preencha prefixo, numero da ficha e numero de fogo.");
      return;
    }

    if (!fotoNumeroFogo) {
      alert("Adicione a foto do numero de fogo.");
      return;
    }

    try {
      setSaving(true);

      const trocaId = createClientUuid();
      const foto = await uploadFotoNumeroFogo(trocaId, fotoNumeroFogo);

      const payload = {
        id: trocaId,
        prefixo,
        ficha_troca: ficha,
        posicao: form.posicao,
        numero_fogo_pneu: numeroFogo,
        observacoes,
        foto_numero_fogo_path: foto.path,
        foto_numero_fogo_url: foto.url,
        pneu_retirado_descricao: null,
        pneu_colocado_descricao: null,
        foto_fogo_retirado_path: null,
        foto_fogo_retirado_url: null,
        foto_pneu_retirado_path: null,
        foto_pneu_retirado_url: null,
        foto_fogo_colocado_path: null,
        foto_fogo_colocado_url: null,
        foto_pneu_colocado_path: null,
        foto_pneu_colocado_url: null,
        criado_por_login: safeText(user?.login || user?.email),
        criado_por_nome: safeText(user?.nome),
        criado_por_id: safeText(user?.auth_user_id),
        origem: "INOVE_WEB_APP",
      };

      const { error } = await supabase.from("pcm_troca_pneus").insert([payload]);
      if (error) throw error;

      setLastSavedId(trocaId);
      setModalOpen(false);
      const latestRows = await loadFichas();
      resetFormState(buildNextFicha(latestRows));

      alert("Ficha de troca de pneus salva com sucesso.");
    } catch (error) {
      console.error("Erro ao salvar ficha de troca de pneus:", error);
      alert(error?.message || "Nao foi possivel salvar a ficha de troca.");
    } finally {
      setSaving(false);
    }
  }

  const fichasHoje = useMemo(() => {
    const today = new Date().toDateString();
    return fichas.filter((item) => new Date(item.created_at).toDateString() === today).length;
  }, [fichas]);

  return (
    <div className="space-y-5">
      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-slate-600">
              <FaClipboardList /> PCM · Central de fichas
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
              Troca de pneus
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Tela simples para a equipe de base lancar e consultar as fichas.
            </p>
          </div>

          <button
            type="button"
            onClick={abrirNovaFicha}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
          >
            <FaPlus />
            Lancar troca de pneus
          </button>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">
              Fichas registradas
            </div>
            <div className="mt-1 text-2xl font-semibold text-slate-950">{fichas.length}</div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">
              Lancadas hoje
            </div>
            <div className="mt-1 text-2xl font-semibold text-slate-950">{fichasHoje}</div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">
              Fluxo
            </div>
            <div className="mt-1 inline-flex items-center gap-2 text-sm font-semibold text-emerald-700">
              <FaCheckCircle />
              Basico e rapido
            </div>
          </div>
        </div>

        {lastSavedId ? (
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
            Ficha salva com sucesso. Protocolo: {lastSavedId}
          </div>
        ) : null}
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Central das fichas</h2>
            <p className="mt-1 text-sm text-slate-500">Ultimas trocas lancadas no PCM.</p>
          </div>
        </div>

        <div className="mt-5 space-y-4">
          {loadingList ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm font-medium text-slate-500">
              Carregando fichas de troca de pneus...
            </div>
          ) : null}

          {!loadingList && fichas.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center">
              <div className="text-lg font-semibold text-slate-800">Nenhuma ficha lancada ainda</div>
              <p className="mt-2 text-sm text-slate-500">
                Clique em <strong>Lancar troca de pneus</strong> para registrar a primeira.
              </p>
            </div>
          ) : null}

          {!loadingList && fichas.map((ficha) => <FichaCard key={ficha.id} ficha={ficha} />)}
        </div>
      </section>

      <NovaFichaModal
        open={modalOpen}
        form={form}
        foto={fotoNumeroFogo}
        saving={saving}
        inputRef={fotoNumeroFogoRef}
        onClose={() => setModalOpen(false)}
        onPrefixoChange={(value) => updateField("prefixo", value)}
        onFieldChange={updateField}
        onPhotoChange={(event) => setFotoNumeroFogo(event.target.files?.[0] || null)}
        onSubmit={handleSalvarFicha}
      />
    </div>
  );
}
