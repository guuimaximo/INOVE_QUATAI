import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { AuthContext } from "../../context/AuthContext";
import { supabase } from "../../supabase";
import {
  FaCamera,
  FaCheckCircle,
  FaClipboardList,
  FaIdCard,
  FaPlus,
  FaSave,
  FaTruckMoving,
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
  pneuRetirado: "",
  pneuColocado: "",
  observacoes: "",
};

const EMPTY_PHOTOS = {
  fogoRetirado: null,
  fogoColocado: null,
  pneuRetirado: null,
  pneuColocado: null,
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

async function uploadTrocaPhoto(trocaId, field, file) {
  const safeName = sanitizeFileName(file?.name);
  const path = `trocas/${trocaId}/${field}_${Date.now()}_${safeName}`;

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

function PhotoCaptureCard({ title, subtitle, file, inputRef, onChange }) {
  const previewUrl = useMemo(() => {
    if (!file) return "";
    return URL.createObjectURL(file);
  }, [file]);

  return (
    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-900">{title}</div>
          <div className="mt-1 text-xs leading-5 text-slate-500">{subtitle}</div>
        </div>
        {file ? (
          <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
            Capturada
          </span>
        ) : null}
      </div>

      <div className="mt-4 overflow-hidden rounded-3xl border border-dashed border-slate-300 bg-white">
        {previewUrl ? (
          <img src={previewUrl} alt={title} className="h-48 w-full object-cover" />
        ) : (
          <div className="flex h-48 flex-col items-center justify-center gap-3 px-6 text-center text-slate-400">
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

function SectionCard({ icon, title, subtitle, children }) {
  return (
    <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-white">
          {icon}
        </div>
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
        </div>
      </div>

      <div className="mt-5">{children}</div>
    </section>
  );
}

function LabeledInput({ label, placeholder, value, onChange }) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">
        {label}
      </span>
      <input
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      />
    </label>
  );
}

function LabeledTextarea({ label, placeholder, value, onChange }) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">
        {label}
      </span>
      <textarea
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        rows={4}
        className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      />
    </label>
  );
}

function FichaCard({ ficha }) {
  return (
    <article className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">
            <FaClipboardList />
            Ficha {ficha.ficha_troca}
          </div>
          <h3 className="mt-3 text-xl font-semibold text-slate-950">
            Prefixo {ficha.prefixo}
          </h3>
          <p className="mt-1 text-sm text-slate-500">{ficha.posicao}</p>
        </div>

        <div className="text-sm text-slate-500">
          <div className="font-semibold text-slate-900">{formatDate(ficha.created_at)}</div>
          <div className="mt-1">{ficha.criado_por_nome || ficha.criado_por_login || "Equipe PCM"}</div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">
            Pneu que saiu
          </div>
          <div className="mt-2 text-sm font-medium text-slate-800">
            {ficha.pneu_retirado_descricao}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">
            Pneu que entrou
          </div>
          <div className="mt-2 text-sm font-medium text-slate-800">
            {ficha.pneu_colocado_descricao}
          </div>
        </div>
      </div>

      {ficha.observacoes ? (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
          {ficha.observacoes}
        </div>
      ) : null}
    </article>
  );
}

export default function PCMTrocaPneus() {
  const { user } = useContext(AuthContext);
  const [form, setForm] = useState(EMPTY_FORM);
  const [photos, setPhotos] = useState(EMPTY_PHOTOS);
  const [saving, setSaving] = useState(false);
  const [loadingList, setLoadingList] = useState(true);
  const [lastSavedId, setLastSavedId] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [fichas, setFichas] = useState([]);

  const fogoRetiradoRef = useRef(null);
  const fogoColocadoRef = useRef(null);
  const pneuRetiradoRef = useRef(null);
  const pneuColocadoRef = useRef(null);

  function resetFormState() {
    setForm(EMPTY_FORM);
    setPhotos(EMPTY_PHOTOS);
    if (fogoRetiradoRef.current) fogoRetiradoRef.current.value = "";
    if (fogoColocadoRef.current) fogoColocadoRef.current.value = "";
    if (pneuRetiradoRef.current) pneuRetiradoRef.current.value = "";
    if (pneuColocadoRef.current) pneuColocadoRef.current.value = "";
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
    } catch (error) {
      console.error("Erro ao carregar fichas de troca de pneus:", error);
      alert(error?.message || "Nao foi possivel carregar a central de fichas.");
    } finally {
      setLoadingList(false);
    }
  }

  useEffect(() => {
    loadFichas();
  }, []);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updatePhoto(field, file) {
    setPhotos((current) => ({ ...current, [field]: file || null }));
  }

  const totalFotos = useMemo(() => Object.values(photos).filter(Boolean).length, [photos]);

  async function handleSalvarFicha() {
    const prefixo = safeText(form.prefixo);
    const ficha = safeText(form.ficha);
    const pneuRetirado = safeText(form.pneuRetirado);
    const pneuColocado = safeText(form.pneuColocado);
    const observacoes = safeText(form.observacoes);
    const todasAsFotos = Object.values(photos).every(Boolean);

    if (!prefixo || !ficha || !pneuRetirado || !pneuColocado) {
      alert("Preencha prefixo, ficha de troca, pneu que saiu e pneu que entrou.");
      return;
    }

    if (!todasAsFotos) {
      alert("As 4 fotos sao obrigatorias para salvar a ficha de troca.");
      return;
    }

    try {
      setSaving(true);

      const trocaId = createClientUuid();
      const uploaded = {
        fogoRetirado: await uploadTrocaPhoto(trocaId, "fogo_retirado", photos.fogoRetirado),
        pneuRetirado: await uploadTrocaPhoto(trocaId, "pneu_retirado", photos.pneuRetirado),
        fogoColocado: await uploadTrocaPhoto(trocaId, "fogo_colocado", photos.fogoColocado),
        pneuColocado: await uploadTrocaPhoto(trocaId, "pneu_colocado", photos.pneuColocado),
      };

      const payload = {
        id: trocaId,
        prefixo,
        ficha_troca: ficha,
        posicao: form.posicao,
        pneu_retirado_descricao: pneuRetirado,
        pneu_colocado_descricao: pneuColocado,
        observacoes,
        foto_fogo_retirado_path: uploaded.fogoRetirado.path,
        foto_fogo_retirado_url: uploaded.fogoRetirado.url,
        foto_pneu_retirado_path: uploaded.pneuRetirado.path,
        foto_pneu_retirado_url: uploaded.pneuRetirado.url,
        foto_fogo_colocado_path: uploaded.fogoColocado.path,
        foto_fogo_colocado_url: uploaded.fogoColocado.url,
        foto_pneu_colocado_path: uploaded.pneuColocado.path,
        foto_pneu_colocado_url: uploaded.pneuColocado.url,
        criado_por_login: safeText(user?.login || user?.email),
        criado_por_nome: safeText(user?.nome),
        criado_por_id: safeText(user?.auth_user_id),
        origem: "INOVE_WEB_APP",
      };

      const { error } = await supabase.from("pcm_troca_pneus").insert([payload]);
      if (error) throw error;

      setLastSavedId(trocaId);
      resetFormState();
      setIsFormOpen(false);
      await loadFichas();

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
      <section className="rounded-[32px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-slate-600">
              <FaClipboardList /> PCM · Central operacional
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">
              Troca de pneus
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Central das fichas de troca de pneus. Aqui voce acompanha o que ja foi lancado e abre
              uma nova ficha quando precisar registrar outra troca.
            </p>
          </div>

          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <button
              type="button"
              onClick={() => {
                setLastSavedId("");
                setIsFormOpen((current) => !current);
              }}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm"
            >
              <FaPlus />
              {isFormOpen ? "Fechar ficha" : "Lancar troca de pneus"}
            </button>
          </div>
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
              Ultimo status
            </div>
            <div className="mt-1 inline-flex items-center gap-2 text-sm font-semibold text-emerald-700">
              <FaCheckCircle />
              Central pronta para uso
            </div>
          </div>
        </div>

        {lastSavedId ? (
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
            Ficha salva com sucesso. Protocolo: {lastSavedId}
          </div>
        ) : null}
      </section>

      {isFormOpen ? (
        <>
          <section className="rounded-[32px] border border-blue-100 bg-blue-50/50 p-5 shadow-sm sm:p-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div className="max-w-3xl">
                <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-blue-700">
                  <FaIdCard /> Nova ficha de troca
                </div>
                <h2 className="mt-4 text-2xl font-semibold tracking-tight text-slate-950">
                  Lancamento da troca de pneus
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Preencha a ficha completa e capture as quatro fotos obrigatorias direto pela camera.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 xl:min-w-[430px]">
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">
                    Posicao
                  </div>
                  <div className="mt-1 text-sm font-semibold text-slate-900">{form.posicao}</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">
                    Fotos
                  </div>
                  <div className="mt-1 text-sm font-semibold text-slate-900">{totalFotos} de 4 anexadas</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">
                    Status
                  </div>
                  <div className="mt-1 inline-flex items-center gap-2 text-sm font-semibold text-emerald-700">
                    <FaCheckCircle />
                    Pronta para salvar
                  </div>
                </div>
              </div>
            </div>
          </section>

          <SectionCard
            icon={<FaIdCard />}
            title="Dados principais"
            subtitle="Informacoes basicas da ficha de troca de pneus."
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              <LabeledInput
                label="Prefixo"
                placeholder="Ex.: 2216"
                value={form.prefixo}
                onChange={(event) => updateField("prefixo", event.target.value)}
              />

              <LabeledInput
                label="Ficha de troca"
                placeholder="Numero da ficha"
                value={form.ficha}
                onChange={(event) => updateField("ficha", event.target.value)}
              />

              <label className="flex flex-col gap-2">
                <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">
                  Posicao no carro
                </span>
                <select
                  value={form.posicao}
                  onChange={(event) => updateField("posicao", event.target.value)}
                  className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                >
                  {POSICOES.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </SectionCard>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <SectionCard
              icon={<FaTruckMoving />}
              title="Pneu que saiu"
              subtitle="Registrar qual pneu foi retirado e anexar as evidencias."
            >
              <div className="space-y-4">
                <LabeledInput
                  label="Qual pneu esta tirando"
                  placeholder="Ex.: Pirelli 275/80 R22.5"
                  value={form.pneuRetirado}
                  onChange={(event) => updateField("pneuRetirado", event.target.value)}
                />

                <div className="grid grid-cols-1 gap-4">
                  <PhotoCaptureCard
                    title="Foto do numero de fogo do pneu retirado"
                    subtitle="Ao tocar em inserir foto, a camera deve abrir no celular."
                    file={photos.fogoRetirado}
                    inputRef={fogoRetiradoRef}
                    onChange={(event) => updatePhoto("fogoRetirado", event.target.files?.[0])}
                  />

                  <PhotoCaptureCard
                    title="Foto do pneu que tirou"
                    subtitle="Foto geral do pneu retirado para comprovar estado e destino."
                    file={photos.pneuRetirado}
                    inputRef={pneuRetiradoRef}
                    onChange={(event) => updatePhoto("pneuRetirado", event.target.files?.[0])}
                  />
                </div>
              </div>
            </SectionCard>

            <SectionCard
              icon={<FaPlus />}
              title="Pneu que entrou"
              subtitle="Registrar qual pneu foi colocado e anexar as evidencias."
            >
              <div className="space-y-4">
                <LabeledInput
                  label="Qual pneu esta colocando"
                  placeholder="Ex.: Recapado / novo / codigo interno"
                  value={form.pneuColocado}
                  onChange={(event) => updateField("pneuColocado", event.target.value)}
                />

                <div className="grid grid-cols-1 gap-4">
                  <PhotoCaptureCard
                    title="Foto do numero de fogo do pneu colocado"
                    subtitle="Registrar o numero de fogo do pneu que entrou no carro."
                    file={photos.fogoColocado}
                    inputRef={fogoColocadoRef}
                    onChange={(event) => updatePhoto("fogoColocado", event.target.files?.[0])}
                  />

                  <PhotoCaptureCard
                    title="Foto do pneu que colocou"
                    subtitle="Foto geral do pneu instalado depois da troca."
                    file={photos.pneuColocado}
                    inputRef={pneuColocadoRef}
                    onChange={(event) => updatePhoto("pneuColocado", event.target.files?.[0])}
                  />
                </div>
              </div>
            </SectionCard>
          </div>

          <SectionCard
            icon={<FaPlus />}
            title="Observacoes da troca"
            subtitle="Campo livre para registrar detalhes da operacao."
          >
            <LabeledTextarea
              label="Observacoes"
              placeholder="Ex.: desgaste irregular, recapagem, pneu sem condicao de retorno, observacao da borracharia..."
              value={form.observacoes}
              onChange={(event) => updateField("observacoes", event.target.value)}
            />
          </SectionCard>

          <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">
                  Obrigatorio
                </div>
                <div className="mt-2 text-sm text-slate-700">
                  Prefixo, posicao, pneu que saiu, pneu que entrou e 4 fotos.
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">
                  Camera
                </div>
                <div className="mt-2 text-sm text-slate-700">
                  O botao Inserir foto ja usa captura da camera no celular.
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">
                  Proxima etapa
                </div>
                <div className="mt-2 text-sm text-slate-700">
                  Salvar ficha, enviar fotos e consultar o historico no banco.
                </div>
              </div>

              <div className="flex items-end">
                <button
                  type="button"
                  onClick={handleSalvarFicha}
                  disabled={saving}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-sm disabled:opacity-60"
                >
                  <FaSave />
                  {saving ? "Salvando..." : "Salvar ficha"}
                </button>
              </div>
            </div>
          </section>
        </>
      ) : null}

      <section className="rounded-[32px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-950">Central das fichas</h2>
            <p className="mt-1 text-sm text-slate-500">
              Ultimas trocas registradas pela operacao.
            </p>
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
                Clique em <strong>Lancar troca de pneus</strong> para registrar a primeira troca.
              </p>
            </div>
          ) : null}

          {!loadingList && fichas.map((ficha) => <FichaCard key={ficha.id} ficha={ficha} />)}
        </div>
      </section>
    </div>
  );
}
