import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { AuthContext } from "../../context/AuthContext";
import CampoPrefixo from "../../components/CampoPrefixo";
import { supabase } from "../../supabase";
import { Capacitor } from "@capacitor/core";
import {
  FaCamera,
  FaCheckCircle,
  FaClipboardList,
  FaEye,
  FaPlus,
  FaSave,
  FaSearch,
  FaTimes,
} from "react-icons/fa";

const BUCKET_FOTOS = "pcm_troca_pneus";

const TIPOS_TROCA = {
  ESTOQUE_CARRO: "ESTOQUE -> CARRO",
  CARRO_CARRO: "CARRO -> CARRO",
};

const POSICOES = [
  "DIANTEIRO DIREITO",
  "DIANTEIRO ESQUERDO",
  "TRASEIRO INTERNO DIREITO",
  "TRASEIRO INTERNO ESQUERDO",
  "TRASEIRO EXTERNO DIREITO",
  "TRASEIRO EXTERNO ESQUERDO",
];

const EMPTY_FORM = {
  ficha: "",
  dataLancamento: "",
  quemLancou: "",
  tipoTroca: TIPOS_TROCA.ESTOQUE_CARRO,
  prefixoRetirada: "",
  posicaoRetirada: POSICOES[0],
  numeroFogoRetirado: "",
  prefixoInstalacao: "",
  posicaoInstalacao: POSICOES[0],
  numeroFogoColocado: "",
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

function nowDisplay() {
  return formatDate(new Date().toISOString());
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

function norm(value) {
  return String(value || "").trim();
}

async function uploadFoto(trocaId, tag, file) {
  const safeName = sanitizeFileName(file?.name);
  const path = `trocas/${trocaId}/${tag}_${Date.now()}_${safeName}`;

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

function Card({ label, value, color }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-center">
      <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">{label}</span>
      <span className={`mt-1 text-3xl font-black ${color}`}>{value}</span>
    </div>
  );
}

function PhotoField({ title, file, inputRef, onChange }) {
  const previewUrl = useMemo(() => {
    if (!file) return "";
    return URL.createObjectURL(file);
  }, [file]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="text-sm font-semibold text-slate-900">{title}</div>
      <div className="mt-1 text-xs text-slate-500">
        Ao tocar em inserir foto, a camera abre no celular.
      </div>

      <div className="mt-3 overflow-hidden rounded-2xl border border-dashed border-slate-300 bg-white">
        {previewUrl ? (
          <img src={previewUrl} alt={title} className="h-40 w-full object-cover" />
        ) : (
          <div className="flex h-40 flex-col items-center justify-center gap-2 text-slate-400">
            <FaCamera className="text-xl" />
            <span className="text-sm font-medium">Nenhuma foto adicionada</span>
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
        className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white"
      >
        <FaCamera />
        Inserir foto
      </button>
    </div>
  );
}

function SectionBlock({ title, children }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="mb-4 text-sm font-black uppercase tracking-wide text-slate-700">{title}</div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">
        {label}
      </div>
      <div className="mt-2 text-sm font-medium text-slate-800">{value || "-"}</div>
    </div>
  );
}

function ConsultaFichaModal({ row, onClose }) {
  if (!row) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-4xl rounded-2xl border border-slate-200 bg-white shadow-2xl max-h-[92vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">
              PCM · Consulta
            </div>
            <h2 className="mt-1 text-xl font-semibold text-slate-950">{row.ficha_troca}</h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <FaTimes />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-5 space-y-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <DetailRow label="Data" value={formatDate(row.created_at)} />
            <DetailRow label="Quem lancou" value={row.criado_por_nome || row.criado_por_login} />
            <DetailRow label="Tipo de troca" value={row.tipo_troca} />
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <SectionBlock title="Pneu retirado">
              <div className="grid grid-cols-1 gap-4">
                <DetailRow label="Prefixo" value={row.prefixo_retirada || row.prefixo} />
                <DetailRow label="Posicao" value={row.posicao_retirada || row.posicao} />
                <DetailRow label="Numero de fogo" value={row.numero_fogo_retirado} />
                {row.foto_numero_fogo_retirado_url ? (
                  <img
                    src={row.foto_numero_fogo_retirado_url}
                    alt="Numero de fogo retirado"
                    className="h-56 w-full rounded-2xl border border-slate-200 object-cover"
                  />
                ) : null}
              </div>
            </SectionBlock>

            <SectionBlock title="Pneu colocado">
              <div className="grid grid-cols-1 gap-4">
                <DetailRow label="Prefixo" value={row.prefixo_instalacao || row.prefixo} />
                <DetailRow label="Posicao" value={row.posicao_instalacao || row.posicao} />
                <DetailRow label="Numero de fogo" value={row.numero_fogo_colocado || row.numero_fogo_pneu} />
                {row.foto_numero_fogo_colocado_url || row.foto_numero_fogo_url ? (
                  <img
                    src={row.foto_numero_fogo_colocado_url || row.foto_numero_fogo_url}
                    alt="Numero de fogo colocado"
                    className="h-56 w-full rounded-2xl border border-slate-200 object-cover"
                  />
                ) : null}
              </div>
            </SectionBlock>
          </div>

          {row.observacoes ? <DetailRow label="Observacoes" value={row.observacoes} /> : null}
        </div>
      </div>
    </div>
  );
}

function FichaModal({
  open,
  form,
  fotoRetirado,
  fotoColocado,
  saving,
  retiradaRef,
  colocadoRef,
  onClose,
  onFieldChange,
  onPhotoRetirado,
  onPhotoColocado,
  onSalvar,
}) {
  if (!open) return null;

  const isEstoqueCarro = form.tipoTroca === TIPOS_TROCA.ESTOQUE_CARRO;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-5xl rounded-2xl border border-slate-200 bg-white shadow-2xl max-h-[92vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">
              PCM · Solicitacao
            </div>
            <h2 className="mt-1 text-xl font-semibold text-slate-950">Lancar troca de pneus</h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <FaTimes />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-5 space-y-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <ReadOnlyField label="Numero da ficha" value={form.ficha} />
            <ReadOnlyField label="Data" value={form.dataLancamento} />
            <ReadOnlyField label="Quem lancou" value={form.quemLancou} />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-2">
              <span className="text-sm text-gray-600">Tipo de troca</span>
              <select
                value={form.tipoTroca}
                onChange={(event) => onFieldChange("tipoTroca", event.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value={TIPOS_TROCA.ESTOQUE_CARRO}>{TIPOS_TROCA.ESTOQUE_CARRO}</option>
                <option value={TIPOS_TROCA.CARRO_CARRO}>{TIPOS_TROCA.CARRO_CARRO}</option>
              </select>
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm text-gray-600">Observacoes</span>
              <input
                type="text"
                value={form.observacoes}
                onChange={(event) => onFieldChange("observacoes", event.target.value)}
                placeholder="Opcional"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </label>
          </div>

          {isEstoqueCarro ? (
            <SectionBlock title="Estoque para carro">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <CampoPrefixo
                    value={form.prefixoInstalacao}
                    onChange={(value) => onFieldChange("prefixoInstalacao", value)}
                    label="Prefixo"
                    inputMode="numeric"
                    pattern="[0-9]*"
                  />
                </div>

                <SelectPosicao
                  label="Posicao do pneu"
                  value={form.posicaoInstalacao}
                  onChange={(value) => onFieldChange("posicaoInstalacao", value)}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-4">
                  <InputField
                    label="Pneu retirado (numero de fogo)"
                    value={form.numeroFogoRetirado}
                    onChange={(value) => onFieldChange("numeroFogoRetirado", value)}
                    inputMode="numeric"
                    pattern="[0-9]*"
                  />
                  <PhotoField
                    title="Foto do numero de fogo do pneu retirado"
                    file={fotoRetirado}
                    inputRef={retiradaRef}
                    onChange={onPhotoRetirado}
                  />
                </div>

                <div className="space-y-4">
                  <InputField
                    label="Pneu colocado (numero de fogo)"
                    value={form.numeroFogoColocado}
                    onChange={(value) => onFieldChange("numeroFogoColocado", value)}
                    inputMode="numeric"
                    pattern="[0-9]*"
                  />
                  <PhotoField
                    title="Foto do numero de fogo do pneu colocado"
                    file={fotoColocado}
                    inputRef={colocadoRef}
                    onChange={onPhotoColocado}
                  />
                </div>
              </div>
            </SectionBlock>
          ) : (
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
              <SectionBlock title="Carro de origem">
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <CampoPrefixo
                      value={form.prefixoRetirada}
                      onChange={(value) => onFieldChange("prefixoRetirada", value)}
                      label="Prefixo"
                      inputMode="numeric"
                      pattern="[0-9]*"
                    />
                  </div>

                  <SelectPosicao
                    label="Posicao do pneu"
                    value={form.posicaoRetirada}
                    onChange={(value) => onFieldChange("posicaoRetirada", value)}
                  />

                  <InputField
                    label="Pneu retirado (numero de fogo)"
                    value={form.numeroFogoRetirado}
                    onChange={(value) => onFieldChange("numeroFogoRetirado", value)}
                    inputMode="numeric"
                    pattern="[0-9]*"
                  />

                  <PhotoField
                    title="Foto do numero de fogo do pneu retirado"
                    file={fotoRetirado}
                    inputRef={retiradaRef}
                    onChange={onPhotoRetirado}
                  />
                </div>
              </SectionBlock>

              <SectionBlock title="Carro de destino">
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <CampoPrefixo
                      value={form.prefixoInstalacao}
                      onChange={(value) => onFieldChange("prefixoInstalacao", value)}
                      label="Prefixo"
                      inputMode="numeric"
                      pattern="[0-9]*"
                    />
                  </div>

                  <SelectPosicao
                    label="Posicao do pneu"
                    value={form.posicaoInstalacao}
                    onChange={(value) => onFieldChange("posicaoInstalacao", value)}
                  />

                  <InputField
                    label="Pneu colocado (numero de fogo)"
                    value={form.numeroFogoColocado}
                    onChange={(value) => onFieldChange("numeroFogoColocado", value)}
                    inputMode="numeric"
                    pattern="[0-9]*"
                  />

                  <PhotoField
                    title="Foto do numero de fogo do pneu colocado"
                    file={fotoColocado}
                    inputRef={colocadoRef}
                    onChange={onPhotoColocado}
                  />
                </div>
              </SectionBlock>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-200 px-5 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-slate-100 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-200"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onSalvar}
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            <FaSave />
            {saving ? "Salvando..." : "Salvar ficha"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ReadOnlyField({ label, value }) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-sm text-gray-600">{label}</span>
      <input
        type="text"
        value={value}
        disabled
        className="w-full rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700"
      />
    </label>
  );
}

function InputField({ label, value, onChange, inputMode = "text", pattern }) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-sm text-gray-600">{label}</span>
      <input
        type="text"
        value={value}
        inputMode={inputMode}
        pattern={pattern}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
      />
    </label>
  );
}

function SelectPosicao({ label, value, onChange }) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-sm text-gray-600">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
      >
        {POSICOES.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </select>
    </label>
  );
}

function formatResumo(row) {
  const tipo = norm(row.tipo_troca);
  const retirada = `${row.prefixo_retirada || row.prefixo || "-"} · ${row.posicao_retirada || row.posicao || "-"}`;
  const instalacao = `${row.prefixo_instalacao || row.prefixo || "-"} · ${row.posicao_instalacao || row.posicao || "-"}`;

  if (tipo === TIPOS_TROCA.ESTOQUE_CARRO) {
    return `Estoque -> ${instalacao}`;
  }

  return `${retirada} -> ${instalacao}`;
}

export default function PCMTrocaPneus() {
  const { user } = useContext(AuthContext);
  const isNativeShell = Capacitor.isNativePlatform();
  const [form, setForm] = useState(EMPTY_FORM);
  const [fotoRetirado, setFotoRetirado] = useState(null);
  const [fotoColocado, setFotoColocado] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [consultaRow, setConsultaRow] = useState(null);
  const [rows, setRows] = useState([]);
  const [cards, setCards] = useState({
    total: 0,
    estoqueCarro: 0,
    carroCarro: 0,
    hoje: 0,
  });
  const [filtros, setFiltros] = useState({
    busca: "",
    tipoTroca: "",
  });

  const retiradaRef = useRef(null);
  const colocadoRef = useRef(null);

  function resetFormState(nextFicha) {
    setForm({
      ...EMPTY_FORM,
      ficha: nextFicha || "",
      dataLancamento: nowDisplay(),
      quemLancou: safeText(user?.nome || user?.login || user?.email) || "Equipe PCM",
    });
    setFotoRetirado(null);
    setFotoColocado(null);
    if (retiradaRef.current) retiradaRef.current.value = "";
    if (colocadoRef.current) colocadoRef.current.value = "";
  }

  async function carregarLista() {
    const { data, error } = await supabase
      .from("pcm_troca_pneus")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) throw error;
    setRows(data || []);
    return data || [];
  }

  function atualizarCards(arr) {
    const hoje = new Date().toDateString();
    setCards({
      total: arr.length,
      estoqueCarro: arr.filter((item) => norm(item.tipo_troca) === TIPOS_TROCA.ESTOQUE_CARRO).length,
      carroCarro: arr.filter((item) => norm(item.tipo_troca) === TIPOS_TROCA.CARRO_CARRO).length,
      hoje: arr.filter((item) => new Date(item.created_at).toDateString() === hoje).length,
    });
  }

  async function aplicar() {
    setLoading(true);
    try {
      const data = await carregarLista();
      atualizarCards(data);
    } catch (error) {
      console.error("Erro ao carregar trocas de pneus:", error);
      alert(error?.message || "Nao foi possivel carregar a central de trocas.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    aplicar();
  }, []);

  async function abrirNovaFicha() {
    const rowsRef = rows.length ? rows : await carregarLista();
    resetFormState(buildNextFicha(rowsRef));
    setModalOpen(true);
  }

  function updateField(field, value) {
    setForm((current) => {
      if (field === "tipoTroca" && value === TIPOS_TROCA.ESTOQUE_CARRO) {
        return {
          ...current,
          tipoTroca: value,
          prefixoRetirada: "",
          posicaoRetirada: POSICOES[0],
        };
      }

      return { ...current, [field]: value };
    });
  }

  async function handleSalvarFicha() {
    const ficha = safeText(form.ficha);
    const tipoTroca = safeText(form.tipoTroca);
    const prefixoInstalacao = safeText(form.prefixoInstalacao);
    const posicaoInstalacao = safeText(form.posicaoInstalacao);
    const numeroFogoRetirado = safeText(form.numeroFogoRetirado);
    const numeroFogoColocado = safeText(form.numeroFogoColocado);
    const observacoes = safeText(form.observacoes);

    const isEstoqueCarro = tipoTroca === TIPOS_TROCA.ESTOQUE_CARRO;
    const prefixoRetirada = isEstoqueCarro ? prefixoInstalacao : safeText(form.prefixoRetirada);
    const posicaoRetirada = isEstoqueCarro ? posicaoInstalacao : safeText(form.posicaoRetirada);

    if (!ficha || !tipoTroca || !prefixoInstalacao || !posicaoInstalacao || !numeroFogoRetirado || !numeroFogoColocado) {
      alert("Preencha os campos obrigatorios da troca.");
      return;
    }

    if (!prefixoRetirada || !posicaoRetirada) {
      alert("Preencha os dados do pneu retirado.");
      return;
    }

    if (!fotoRetirado || !fotoColocado) {
      alert("As duas fotos do numero de fogo sao obrigatorias.");
      return;
    }

    try {
      setSaving(true);
      const trocaId = createClientUuid();
      const uploadedRetirado = await uploadFoto(trocaId, "numero_fogo_retirado", fotoRetirado);
      const uploadedColocado = await uploadFoto(trocaId, "numero_fogo_colocado", fotoColocado);

      const payload = {
        id: trocaId,
        ficha_troca: ficha,
        prefixo: prefixoInstalacao,
        posicao: posicaoInstalacao,
        tipo_troca: tipoTroca,
        prefixo_retirada: prefixoRetirada,
        posicao_retirada: posicaoRetirada,
        numero_fogo_retirado: numeroFogoRetirado,
        foto_numero_fogo_retirado_path: uploadedRetirado.path,
        foto_numero_fogo_retirado_url: uploadedRetirado.url,
        prefixo_instalacao: prefixoInstalacao,
        posicao_instalacao: posicaoInstalacao,
        numero_fogo_colocado: numeroFogoColocado,
        foto_numero_fogo_colocado_path: uploadedColocado.path,
        foto_numero_fogo_colocado_url: uploadedColocado.url,
        numero_fogo_pneu: numeroFogoColocado,
        foto_numero_fogo_path: uploadedColocado.path,
        foto_numero_fogo_url: uploadedColocado.url,
        observacoes,
        criado_por_login: safeText(user?.login || user?.email),
        criado_por_nome: safeText(user?.nome),
        criado_por_id: safeText(user?.auth_user_id),
        origem: "INOVE_WEB_APP",
      };

      const { error } = await supabase.from("pcm_troca_pneus").insert([payload]);
      if (error) throw error;

      setModalOpen(false);
      const data = await carregarLista();
      atualizarCards(data);
      resetFormState(buildNextFicha(data));
      alert("Ficha de troca de pneus salva com sucesso.");
    } catch (error) {
      console.error("Erro ao salvar ficha de troca de pneus:", error);
      alert(error?.message || "Nao foi possivel salvar a ficha de troca.");
    } finally {
      setSaving(false);
    }
  }

  function limparFiltros() {
    setFiltros({
      busca: "",
      tipoTroca: "",
    });
  }

  const rowsFiltradas = useMemo(() => {
    const busca = norm(filtros.busca).toLowerCase();
    return rows.filter((row) => {
      const tipoOk = !filtros.tipoTroca || row.tipo_troca === filtros.tipoTroca;
      if (!tipoOk) return false;

      if (!busca) return true;

      const alvo = [
        row.ficha_troca,
        row.prefixo_retirada,
        row.prefixo_instalacao,
        row.numero_fogo_retirado,
        row.numero_fogo_colocado,
        row.criado_por_nome,
        row.criado_por_login,
      ]
        .map((item) => norm(item).toLowerCase())
        .join(" ");

      return alvo.includes(busca);
    });
  }, [rows, filtros]);

  const inputClass =
    "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all";

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6 bg-slate-50 min-h-screen">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Controle de Troca de Pneus
          </h1>
          <p className="text-sm text-slate-500 mt-1">Central operacional do PCM</p>
        </div>

        <button
          type="button"
          onClick={abrirNovaFicha}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
        >
          <FaPlus />
          Lancar troca de pneus
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card label="Total" value={cards.total} color="text-slate-900" />
        <Card label="Estoque -> Carro" value={cards.estoqueCarro} color="text-blue-600" />
        <Card label="Carro -> Carro" value={cards.carroCarro} color="text-orange-600" />
        <Card label="Lancadas Hoje" value={cards.hoje} color="text-emerald-600" />
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4">Filtros</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <FaSearch className="absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar ficha, prefixo ou numero de fogo..."
              value={filtros.busca}
              onChange={(event) => setFiltros({ ...filtros, busca: event.target.value })}
              className={`${inputClass} pl-10`}
            />
          </div>

          <select
            value={filtros.tipoTroca}
            onChange={(event) => setFiltros({ ...filtros, tipoTroca: event.target.value })}
            className={inputClass}
          >
            <option value="">Todos os tipos</option>
            <option value={TIPOS_TROCA.ESTOQUE_CARRO}>{TIPOS_TROCA.ESTOQUE_CARRO}</option>
            <option value={TIPOS_TROCA.CARRO_CARRO}>{TIPOS_TROCA.CARRO_CARRO}</option>
          </select>

          <div className="flex justify-end gap-3">
            <button
              onClick={limparFiltros}
              className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
            >
              Limpar
            </button>
            <button
              onClick={aplicar}
              disabled={loading}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 shadow-sm disabled:opacity-50 transition-colors"
            >
              {loading ? "Atualizando..." : "Atualizar"}
            </button>
          </div>
        </div>
      </div>

      {isNativeShell ? (
        <div className="space-y-3">
          {!loading && rowsFiltradas.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white px-6 py-8 text-center text-slate-500 shadow-sm">
              Nenhuma ficha encontrada com os filtros atuais.
            </div>
          ) : (
            rowsFiltradas.map((row) => (
              <button
                key={row.id}
                type="button"
                onClick={() => setConsultaRow(row)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-left shadow-sm transition hover:border-blue-200 hover:bg-blue-50/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-bold text-slate-900">Prefixo {row.prefixo_instalacao || row.prefixo || "-"}</div>
                  </div>
                  <div className="text-right text-xs text-slate-500">
                    {formatDate(row.created_at)}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-xs font-semibold tracking-wider">
                <tr>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Ficha</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Data</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Quem lancou</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Tipo</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Resumo</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Numero de fogo</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap text-right">Acoes</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {!loading && rowsFiltradas.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-slate-500">
                      Nenhuma ficha encontrada com os filtros atuais.
                    </td>
                  </tr>
                ) : (
                  rowsFiltradas.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3 font-bold text-slate-700">{row.ficha_troca}</td>
                      <td className="px-4 py-3 text-slate-600">{formatDate(row.created_at)}</td>
                      <td className="px-4 py-3 text-slate-700 font-medium">
                        {row.criado_por_nome || row.criado_por_login || "-"}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{row.tipo_troca || "-"}</td>
                      <td className="px-4 py-3 text-slate-600">{formatResumo(row)}</td>
                      <td className="px-4 py-3 text-slate-700 font-medium">
                        {row.numero_fogo_colocado || row.numero_fogo_pneu || "-"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => setConsultaRow(row)}
                          className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-200"
                        >
                          <FaEye />
                          Consultar
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <FichaModal
        open={modalOpen}
        form={form}
        fotoRetirado={fotoRetirado}
        fotoColocado={fotoColocado}
        saving={saving}
        retiradaRef={retiradaRef}
        colocadoRef={colocadoRef}
        onClose={() => setModalOpen(false)}
        onFieldChange={updateField}
        onPhotoRetirado={(event) => setFotoRetirado(event.target.files?.[0] || null)}
        onPhotoColocado={(event) => setFotoColocado(event.target.files?.[0] || null)}
        onSalvar={handleSalvarFicha}
      />
      <ConsultaFichaModal row={consultaRow} onClose={() => setConsultaRow(null)} />
    </div>
  );
}
