import { useContext, useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { Capacitor } from "@capacitor/core";
import {
  FaCamera,
  FaCheckCircle,
  FaClipboardCheck,
  FaClipboardList,
  FaDownload,
  FaEye,
  FaPlus,
  FaSave,
  FaSearch,
  FaTimes,
  FaWarehouse,
} from "react-icons/fa";

import { AuthContext } from "../../context/AuthContext";
import CampoPrefixo from "../../components/CampoPrefixo";
import { supabase } from "../../supabase";

const TAB_TROCA = "troca";
const TAB_AUDITORIA = "auditoria";
const TAB_ESTOQUE = "estoque";

const BUCKET_TROCA = "pcm_troca_pneus";
const BUCKET_AUDITORIA = "pcm_auditoria_pneus";

const TIPO_TROCA_ESTOQUE = "ESTOQUE -> CARRO";
const TIPO_TROCA_CARRO = "CARRO -> CARRO";

const POSICOES = [
  "DIANTEIRO DIREITO",
  "DIANTEIRO ESQUERDO",
  "TRASEIRO INTERNO DIREITO",
  "TRASEIRO INTERNO ESQUERDO",
  "TRASEIRO EXTERNO DIREITO",
  "TRASEIRO EXTERNO ESQUERDO",
];

const SITUACOES_ESTOQUE = [
  "NOVO",
  "USADO ( PARA USO )",
  "SUCATA",
  "ENVIAR PARA RECAPAGEM",
  "RECAPADO",
];

function norm(value) {
  return String(value || "").trim();
}

function safeText(value) {
  const text = norm(value);
  return text || null;
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

function formatDateOnly(value) {
  if (!value) return "-";
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function nowDisplay() {
  return formatDate(new Date().toISOString());
}

function extractDateOnly(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function inDateRange(value, inicio, fim) {
  const current = extractDateOnly(value);
  if (!current) return false;
  if (inicio && current < inicio) return false;
  if (fim && current > fim) return false;
  return true;
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

function extractSequence(value) {
  const digits = String(value || "").match(/(\d+)$/);
  return digits ? Number.parseInt(digits[1], 10) : 0;
}

function buildNextFicha(rows, field, prefix) {
  const maxValue = (rows || []).reduce((max, row) => {
    const current = extractSequence(row?.[field]);
    return current > max ? current : max;
  }, 0);
  return `${prefix}-${String(maxValue + 1).padStart(6, "0")}`;
}

function createAuditPositions() {
  return POSICOES.map((posicao) => ({
    posicao,
    numeroFogo: "",
    foto: null,
  }));
}

function createTrocaForm(nextFicha, userName) {
  return {
    ficha: nextFicha,
    dataLancamento: nowDisplay(),
    quemLancou: userName,
    tipoTroca: TIPO_TROCA_ESTOQUE,
    prefixoRetirada: "",
    posicaoRetirada: POSICOES[0],
    numeroFogoRetirado: "",
    fotoRetirado: null,
    prefixoInstalacao: "",
    posicaoInstalacao: POSICOES[0],
    numeroFogoColocado: "",
    fotoColocado: null,
    observacoes: "",
  };
}

function createAuditoriaForm(nextFicha, userName) {
  return {
    ficha: nextFicha,
    dataLancamento: nowDisplay(),
    quemLancou: userName,
    prefixo: "",
    observacoes: "",
    posicoes: createAuditPositions(),
  };
}

function createEstoqueForm(nextFicha, userName) {
  return {
    ficha: nextFicha,
    dataLancamento: nowDisplay(),
    quemLancou: userName,
    numeroPneu: "",
    marca: "",
    situacao: SITUACOES_ESTOQUE[0],
    observacoes: "",
  };
}

async function uploadFoto(bucket, folder, recordId, tag, file) {
  const safeName = sanitizeFileName(file?.name);
  const path = `${folder}/${recordId}/${tag}_${Date.now()}_${safeName}`;

  const { error: uploadError } = await supabase.storage.from(bucket).upload(path, file, {
    upsert: false,
    contentType: file?.type || undefined,
    cacheControl: "3600",
  });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return {
    path,
    url: data?.publicUrl || "",
  };
}

function buildTrocaResumo(row) {
  if (norm(row.tipo_troca) === TIPO_TROCA_ESTOQUE) {
    return `Estoque -> ${row.prefixo_instalacao || row.prefixo || "-"} · ${row.posicao_instalacao || row.posicao || "-"}`;
  }

  return `${row.prefixo_retirada || "-"} · ${row.posicao_retirada || "-"} -> ${row.prefixo_instalacao || "-"} · ${row.posicao_instalacao || "-"}`;
}

function getAuditoriaPosicoes(row) {
  return Array.isArray(row?.posicoes) ? row.posicoes : [];
}

function buildAuditoriaResumo(row) {
  return `${getAuditoriaPosicoes(row).length} posicoes auditadas`;
}

function CardResumo({ label, value, color }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">{label}</div>
      <div className={`mt-2 text-3xl font-black ${color}`}>{value}</div>
    </div>
  );
}

function ModalShell({ title, subtitle, onClose, children, footer, maxWidth = "max-w-5xl" }) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
      <div className={`flex max-h-[92vh] w-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl ${maxWidth}`}>
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">{subtitle}</div>
            <h2 className="mt-1 text-xl font-semibold text-slate-950">{title}</h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <FaTimes />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-5">{children}</div>
        <div className="border-t border-slate-200 px-5 py-4">{footer}</div>
      </div>
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
      <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">{label}</div>
      <div className="mt-2 text-sm font-medium text-slate-800">{value || "-"}</div>
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

function InputField({ label, value, onChange, placeholder = "", inputMode = "text", pattern }) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-sm text-gray-600">{label}</span>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        inputMode={inputMode}
        pattern={pattern}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
      />
    </label>
  );
}

function SelectField({ label, value, onChange, options }) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-sm text-gray-600">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option || "Todos"}
          </option>
        ))}
      </select>
    </label>
  );
}

function PhotoField({ title, file, imageUrl = "", inputId, onChange }) {
  const [previewUrl, setPreviewUrl] = useState(imageUrl || "");

  useEffect(() => {
    if (!file) {
      setPreviewUrl(imageUrl || "");
      return undefined;
    }

    const nextPreview = URL.createObjectURL(file);
    setPreviewUrl(nextPreview);
    return () => URL.revokeObjectURL(nextPreview);
  }, [file, imageUrl]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="text-sm font-semibold text-slate-900">{title}</div>
      <div className="mt-1 text-xs text-slate-500">Ao tocar em inserir foto, a camera abre no celular.</div>

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
        id={inputId}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={onChange}
      />

      <button
        type="button"
        onClick={() => document.getElementById(inputId)?.click()}
        className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white"
      >
        <FaCamera />
        Inserir foto
      </button>
    </div>
  );
}

function TabButton({ active, onClick, icon, title, count }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-w-[180px] items-center gap-3 rounded-2xl border px-4 py-3 text-left transition ${
        active
          ? "border-blue-200 bg-blue-50 text-blue-700"
          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
      }`}
    >
      <div className="rounded-xl bg-white/80 p-2 shadow-sm">{icon}</div>
      <div className="min-w-0">
        <div className="text-sm font-bold">{title}</div>
        <div className="text-xs opacity-80">{count} registros</div>
      </div>
    </button>
  );
}

function TrocaModal({ open, form, saving, onClose, onFieldChange, onFotoChange, onSalvar }) {
  if (!open) return null;

  const isEstoqueCarro = form.tipoTroca === TIPO_TROCA_ESTOQUE;

  return (
    <ModalShell
      title="Lancar troca de pneus"
      subtitle="PCM · Solicitacao"
      onClose={onClose}
      footer={
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
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
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <ReadOnlyField label="Numero da ficha" value={form.ficha} />
          <ReadOnlyField label="Data" value={form.dataLancamento} />
          <ReadOnlyField label="Quem lancou" value={form.quemLancou} />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <SelectField
            label="Tipo de troca"
            value={form.tipoTroca}
            onChange={(value) => onFieldChange("tipoTroca", value)}
            options={[TIPO_TROCA_ESTOQUE, TIPO_TROCA_CARRO]}
          />

          <InputField
            label="Observacoes"
            value={form.observacoes}
            onChange={(value) => onFieldChange("observacoes", value)}
            placeholder="Opcional"
          />
        </div>

        {isEstoqueCarro ? (
          <SectionBlock title="Estoque para carro">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <CampoPrefixo
                value={form.prefixoInstalacao}
                onChange={(value) => onFieldChange("prefixoInstalacao", value)}
                label="Prefixo"
                inputMode="numeric"
                pattern="[0-9]*"
              />

              <SelectField
                label="Posicao do pneu"
                value={form.posicaoInstalacao}
                onChange={(value) => onFieldChange("posicaoInstalacao", value)}
                options={POSICOES}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-4">
                <InputField
                  label="Numero do pneu (retirado)"
                  value={form.numeroFogoRetirado}
                  onChange={(value) => onFieldChange("numeroFogoRetirado", value)}
                  inputMode="numeric"
                  pattern="[0-9]*"
                />
                <PhotoField
                  title="Foto do numero do pneu retirado"
                  file={form.fotoRetirado}
                  inputId="troca-retirado"
                  onChange={(event) => onFotoChange("fotoRetirado", event.target.files?.[0] || null)}
                />
              </div>

              <div className="space-y-4">
                <InputField
                  label="Numero do pneu (colocado)"
                  value={form.numeroFogoColocado}
                  onChange={(value) => onFieldChange("numeroFogoColocado", value)}
                  inputMode="numeric"
                  pattern="[0-9]*"
                />
                <PhotoField
                  title="Foto do numero do pneu colocado"
                  file={form.fotoColocado}
                  inputId="troca-colocado"
                  onChange={(event) => onFotoChange("fotoColocado", event.target.files?.[0] || null)}
                />
              </div>
            </div>
          </SectionBlock>
        ) : (
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <SectionBlock title="Carro de origem">
              <div className="grid grid-cols-1 gap-4">
                <CampoPrefixo
                  value={form.prefixoRetirada}
                  onChange={(value) => onFieldChange("prefixoRetirada", value)}
                  label="Prefixo"
                  inputMode="numeric"
                  pattern="[0-9]*"
                />
                <SelectField
                  label="Posicao do pneu"
                  value={form.posicaoRetirada}
                  onChange={(value) => onFieldChange("posicaoRetirada", value)}
                  options={POSICOES}
                />
                <InputField
                  label="Numero do pneu (retirado)"
                  value={form.numeroFogoRetirado}
                  onChange={(value) => onFieldChange("numeroFogoRetirado", value)}
                  inputMode="numeric"
                  pattern="[0-9]*"
                />
                <PhotoField
                  title="Foto do numero do pneu retirado"
                  file={form.fotoRetirado}
                  inputId="troca-retirado"
                  onChange={(event) => onFotoChange("fotoRetirado", event.target.files?.[0] || null)}
                />
              </div>
            </SectionBlock>

            <SectionBlock title="Carro de destino">
              <div className="grid grid-cols-1 gap-4">
                <CampoPrefixo
                  value={form.prefixoInstalacao}
                  onChange={(value) => onFieldChange("prefixoInstalacao", value)}
                  label="Prefixo"
                  inputMode="numeric"
                  pattern="[0-9]*"
                />
                <SelectField
                  label="Posicao do pneu"
                  value={form.posicaoInstalacao}
                  onChange={(value) => onFieldChange("posicaoInstalacao", value)}
                  options={POSICOES}
                />
                <InputField
                  label="Numero do pneu (colocado)"
                  value={form.numeroFogoColocado}
                  onChange={(value) => onFieldChange("numeroFogoColocado", value)}
                  inputMode="numeric"
                  pattern="[0-9]*"
                />
                <PhotoField
                  title="Foto do numero do pneu colocado"
                  file={form.fotoColocado}
                  inputId="troca-colocado"
                  onChange={(event) => onFotoChange("fotoColocado", event.target.files?.[0] || null)}
                />
              </div>
            </SectionBlock>
          </div>
        )}
      </div>
    </ModalShell>
  );
}

function AuditoriaModal({ open, form, saving, onClose, onFieldChange, onPosicaoChange, onSalvar }) {
  if (!open) return null;

  return (
    <ModalShell
      title="Lancar auditoria de pneus"
      subtitle="PCM · Auditoria"
      onClose={onClose}
      maxWidth="max-w-6xl"
      footer={
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
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
            {saving ? "Salvando..." : "Salvar auditoria"}
          </button>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <ReadOnlyField label="Numero da ficha" value={form.ficha} />
          <ReadOnlyField label="Data" value={form.dataLancamento} />
          <ReadOnlyField label="Quem lancou" value={form.quemLancou} />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <CampoPrefixo
            value={form.prefixo}
            onChange={(value) => onFieldChange("prefixo", value)}
            label="Prefixo"
            inputMode="numeric"
            pattern="[0-9]*"
          />

          <InputField
            label="Observacoes"
            value={form.observacoes}
            onChange={(value) => onFieldChange("observacoes", value)}
            placeholder="Opcional"
          />
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          {form.posicoes.map((posicao, index) => (
            <SectionBlock key={posicao.posicao} title={posicao.posicao}>
              <InputField
                label="Numero de fogo"
                value={posicao.numeroFogo}
                onChange={(value) => onPosicaoChange(index, "numeroFogo", value)}
                inputMode="numeric"
                pattern="[0-9]*"
              />

              <PhotoField
                title="Foto do numero de fogo"
                file={posicao.foto}
                inputId={`auditoria-${index}`}
                onChange={(event) => onPosicaoChange(index, "foto", event.target.files?.[0] || null)}
              />
            </SectionBlock>
          ))}
        </div>
      </div>
    </ModalShell>
  );
}

function EstoqueModal({ open, form, saving, onClose, onFieldChange, onSalvar }) {
  if (!open) return null;

  return (
    <ModalShell
      title="Lancar estoque de pneus"
      subtitle="PCM · Estoque"
      onClose={onClose}
      footer={
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
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
            {saving ? "Salvando..." : "Salvar estoque"}
          </button>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <ReadOnlyField label="Numero da ficha" value={form.ficha} />
          <ReadOnlyField label="Data" value={form.dataLancamento} />
          <ReadOnlyField label="Quem lancou" value={form.quemLancou} />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <InputField
            label="Numero do pneu"
            value={form.numeroPneu}
            onChange={(value) => onFieldChange("numeroPneu", value)}
            inputMode="numeric"
            pattern="[0-9]*"
          />
          <InputField label="Marca" value={form.marca} onChange={(value) => onFieldChange("marca", value)} />
          <SelectField
            label="Situacao"
            value={form.situacao}
            onChange={(value) => onFieldChange("situacao", value)}
            options={SITUACOES_ESTOQUE}
          />
          <InputField
            label="Observacoes"
            value={form.observacoes}
            onChange={(value) => onFieldChange("observacoes", value)}
            placeholder="Opcional"
          />
        </div>
      </div>
    </ModalShell>
  );
}

function ConsultaModal({
  open,
  tab,
  row,
  transnetSaving,
  onClose,
  onMarcarTransnet,
}) {
  if (!open || !row) return null;

  let title = "";
  let content = null;
  let footer = null;

  if (tab === TAB_TROCA) {
    const transnetLancado = !!row.transnet_lancado_em;

    title = row.ficha_troca || "Ficha de troca";
    content = (
      <div className="space-y-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <DetailRow label="Data" value={formatDate(row.created_at)} />
          <DetailRow label="Quem lancou" value={row.criado_por_nome || row.criado_por_login} />
          <DetailRow label="Tipo de troca" value={row.tipo_troca} />
          <DetailRow
            label="Transnet"
            value={transnetLancado ? `Lancado em ${formatDate(row.transnet_lancado_em)}` : "Pendente"}
          />
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <SectionBlock title="Pneu retirado">
            <div className="grid grid-cols-1 gap-4">
              <DetailRow label="Prefixo" value={row.prefixo_retirada || row.prefixo} />
              <DetailRow label="Posicao" value={row.posicao_retirada || row.posicao} />
              <DetailRow label="Numero do pneu" value={row.numero_fogo_retirado} />
              {row.foto_numero_fogo_retirado_url ? (
                <img
                  src={row.foto_numero_fogo_retirado_url}
                  alt="Numero do pneu retirado"
                  className="h-56 w-full rounded-2xl border border-slate-200 object-cover"
                />
              ) : null}
            </div>
          </SectionBlock>

          <SectionBlock title="Pneu colocado">
            <div className="grid grid-cols-1 gap-4">
              <DetailRow label="Prefixo" value={row.prefixo_instalacao || row.prefixo} />
              <DetailRow label="Posicao" value={row.posicao_instalacao || row.posicao} />
              <DetailRow label="Numero do pneu" value={row.numero_fogo_colocado || row.numero_fogo_pneu} />
              {row.foto_numero_fogo_colocado_url || row.foto_numero_fogo_url ? (
                <img
                  src={row.foto_numero_fogo_colocado_url || row.foto_numero_fogo_url}
                  alt="Numero do pneu colocado"
                  className="h-56 w-full rounded-2xl border border-slate-200 object-cover"
                />
              ) : null}
            </div>
          </SectionBlock>
        </div>

        {row.transnet_lancado_por_nome || row.transnet_lancado_por_login ? (
          <DetailRow
            label="Lancado no Transnet por"
            value={`${row.transnet_lancado_por_nome || row.transnet_lancado_por_login} em ${formatDate(row.transnet_lancado_em)}`}
          />
        ) : null}

        {row.observacoes ? <DetailRow label="Observacoes" value={row.observacoes} /> : null}
      </div>
    );

    footer = (
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-xs text-slate-500">
          {transnetLancado ? "Esse formulario ja foi marcado como lancado no Transnet." : "Marque quando o formulario ja tiver sido lancado no Transnet."}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-slate-100 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-200"
          >
            Fechar
          </button>
          <button
            type="button"
            onClick={onMarcarTransnet}
            disabled={transnetLancado || transnetSaving}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <FaCheckCircle />
            {transnetSaving ? "Gravando..." : transnetLancado ? "Ja lancado no Transnet" : "Lancado no Transnet"}
          </button>
        </div>
      </div>
    );
  }

  if (tab === TAB_AUDITORIA) {
    title = row.ficha_auditoria || "Auditoria de pneus";
    content = (
      <div className="space-y-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <DetailRow label="Data" value={formatDate(row.created_at)} />
          <DetailRow label="Quem lancou" value={row.criado_por_nome || row.criado_por_login} />
          <DetailRow label="Prefixo" value={row.prefixo} />
          <DetailRow label="Resumo" value={buildAuditoriaResumo(row)} />
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          {getAuditoriaPosicoes(row).map((item) => (
            <SectionBlock key={item.posicao} title={item.posicao}>
              <DetailRow label="Numero de fogo" value={item.numero_fogo} />
              {item.foto_url ? (
                <img
                  src={item.foto_url}
                  alt={item.posicao}
                  className="h-56 w-full rounded-2xl border border-slate-200 object-cover"
                />
              ) : null}
            </SectionBlock>
          ))}
        </div>

        {row.observacoes ? <DetailRow label="Observacoes" value={row.observacoes} /> : null}
      </div>
    );

    footer = (
      <div className="flex justify-end">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg bg-slate-100 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-200"
        >
          Fechar
        </button>
      </div>
    );
  }

  if (tab === TAB_ESTOQUE) {
    title = row.ficha_estoque || "Estoque de pneus";
    content = (
      <div className="space-y-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <DetailRow label="Data" value={formatDate(row.created_at)} />
          <DetailRow label="Quem lancou" value={row.criado_por_nome || row.criado_por_login} />
          <DetailRow label="Situacao" value={row.situacao} />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <DetailRow label="Numero do pneu" value={row.numero_pneu} />
          <DetailRow label="Marca" value={row.marca} />
        </div>
        {row.observacoes ? <DetailRow label="Observacoes" value={row.observacoes} /> : null}
      </div>
    );

    footer = (
      <div className="flex justify-end">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg bg-slate-100 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-200"
        >
          Fechar
        </button>
      </div>
    );
  }

  return (
    <ModalShell
      title={title}
      subtitle="PCM · Consulta"
      onClose={onClose}
      footer={footer}
      maxWidth={tab === TAB_AUDITORIA ? "max-w-6xl" : "max-w-5xl"}
    >
      {content}
    </ModalShell>
  );
}

export default function PCMTrocaPneus() {
  const { user } = useContext(AuthContext);
  const isNativeShell = Capacitor.isNativePlatform();
  const userName = safeText(user?.nome || user?.login || user?.email) || "Equipe PCM";

  const [activeTab, setActiveTab] = useState(TAB_TROCA);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [transnetSaving, setTransnetSaving] = useState(false);

  const [trocas, setTrocas] = useState([]);
  const [auditorias, setAuditorias] = useState([]);
  const [estoqueRows, setEstoqueRows] = useState([]);

  const [trocaForm, setTrocaForm] = useState(() => createTrocaForm("", userName));
  const [auditoriaForm, setAuditoriaForm] = useState(() => createAuditoriaForm("", userName));
  const [estoqueForm, setEstoqueForm] = useState(() => createEstoqueForm("", userName));

  const [trocaOpen, setTrocaOpen] = useState(false);
  const [auditoriaOpen, setAuditoriaOpen] = useState(false);
  const [estoqueOpen, setEstoqueOpen] = useState(false);

  const [consulta, setConsulta] = useState({ open: false, tab: TAB_TROCA, row: null });

  const [trocaFiltros, setTrocaFiltros] = useState({
    busca: "",
    tipoTroca: "",
    transnet: "",
    dataInicio: "",
    dataFim: "",
  });
  const [auditoriaFiltros, setAuditoriaFiltros] = useState({
    busca: "",
    dataInicio: "",
    dataFim: "",
  });
  const [estoqueFiltros, setEstoqueFiltros] = useState({
    busca: "",
    situacao: "",
    dataInicio: "",
    dataFim: "",
  });

  async function carregarTrocas() {
    const { data, error } = await supabase
      .from("pcm_troca_pneus")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(300);

    if (error) throw error;
    setTrocas(data || []);
    return data || [];
  }

  async function carregarAuditorias() {
    const { data, error } = await supabase
      .from("pcm_auditoria_pneus")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(300);

    if (error) throw error;
    setAuditorias(data || []);
    return data || [];
  }

  async function carregarEstoque() {
    const { data, error } = await supabase
      .from("pcm_estoque_pneus")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(300);

    if (error) throw error;
    setEstoqueRows(data || []);
    return data || [];
  }

  async function aplicar() {
    setLoading(true);
    try {
      await Promise.all([carregarTrocas(), carregarAuditorias(), carregarEstoque()]);
    } catch (error) {
      console.error("Erro ao carregar central de pneus:", error);
      alert(error?.message || "Nao foi possivel carregar a central de pneus.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    aplicar();
  }, []);

  useEffect(() => {
    setTrocaForm((current) => ({ ...current, dataLancamento: nowDisplay(), quemLancou: userName }));
    setAuditoriaForm((current) => ({ ...current, dataLancamento: nowDisplay(), quemLancou: userName }));
    setEstoqueForm((current) => ({ ...current, dataLancamento: nowDisplay(), quemLancou: userName }));
  }, [userName]);

  const cardsTroca = useMemo(() => {
    const hoje = extractDateOnly(new Date().toISOString());
    return {
      total: trocas.length,
      estoqueCarro: trocas.filter((item) => norm(item.tipo_troca) === TIPO_TROCA_ESTOQUE).length,
      carroCarro: trocas.filter((item) => norm(item.tipo_troca) === TIPO_TROCA_CARRO).length,
      transnet: trocas.filter((item) => !!item.transnet_lancado_em).length,
      hoje: trocas.filter((item) => extractDateOnly(item.created_at) === hoje).length,
    };
  }, [trocas]);

  const cardsAuditoria = useMemo(() => {
    const hoje = extractDateOnly(new Date().toISOString());
    const prefixosUnicos = new Set(auditorias.map((item) => norm(item.prefixo)).filter(Boolean));
    return {
      total: auditorias.length,
      hoje: auditorias.filter((item) => extractDateOnly(item.created_at) === hoje).length,
      prefixos: prefixosUnicos.size,
      completas: auditorias.filter((item) => getAuditoriaPosicoes(item).length === POSICOES.length).length,
    };
  }, [auditorias]);

  const cardsEstoque = useMemo(() => {
    return {
      total: estoqueRows.length,
      novo: estoqueRows.filter((item) => norm(item.situacao) === "NOVO").length,
      uso: estoqueRows.filter((item) => norm(item.situacao) === "USADO ( PARA USO )").length,
      recapagem: estoqueRows.filter((item) => norm(item.situacao) === "ENVIAR PARA RECAPAGEM").length,
      sucata: estoqueRows.filter((item) => norm(item.situacao) === "SUCATA").length,
    };
  }, [estoqueRows]);

  const trocasFiltradas = useMemo(() => {
    const busca = norm(trocaFiltros.busca).toLowerCase();
    return trocas.filter((row) => {
      if (!inDateRange(row.created_at, trocaFiltros.dataInicio, trocaFiltros.dataFim)) return false;
      if (trocaFiltros.tipoTroca && row.tipo_troca !== trocaFiltros.tipoTroca) return false;
      if (trocaFiltros.transnet === "sim" && !row.transnet_lancado_em) return false;
      if (trocaFiltros.transnet === "nao" && row.transnet_lancado_em) return false;
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
  }, [trocas, trocaFiltros]);

  const auditoriasFiltradas = useMemo(() => {
    const busca = norm(auditoriaFiltros.busca).toLowerCase();
    return auditorias.filter((row) => {
      if (!inDateRange(row.created_at, auditoriaFiltros.dataInicio, auditoriaFiltros.dataFim)) return false;
      if (!busca) return true;

      const alvo = [
        row.ficha_auditoria,
        row.prefixo,
        row.criado_por_nome,
        row.criado_por_login,
        ...getAuditoriaPosicoes(row).map((item) => item.numero_fogo),
      ]
        .map((item) => norm(item).toLowerCase())
        .join(" ");

      return alvo.includes(busca);
    });
  }, [auditorias, auditoriaFiltros]);

  const estoqueFiltrado = useMemo(() => {
    const busca = norm(estoqueFiltros.busca).toLowerCase();
    return estoqueRows.filter((row) => {
      if (!inDateRange(row.created_at, estoqueFiltros.dataInicio, estoqueFiltros.dataFim)) return false;
      if (estoqueFiltros.situacao && row.situacao !== estoqueFiltros.situacao) return false;
      if (!busca) return true;

      const alvo = [row.ficha_estoque, row.numero_pneu, row.marca, row.situacao, row.criado_por_nome, row.criado_por_login]
        .map((item) => norm(item).toLowerCase())
        .join(" ");

      return alvo.includes(busca);
    });
  }, [estoqueRows, estoqueFiltros]);

  function openConsulta(tab, row) {
    setConsulta({ open: true, tab, row });
  }

  function closeConsulta() {
    setConsulta({ open: false, tab: activeTab, row: null });
  }

  function limparFiltrosAtivos() {
    if (activeTab === TAB_TROCA) {
      setTrocaFiltros({
        busca: "",
        tipoTroca: "",
        transnet: "",
        dataInicio: "",
        dataFim: "",
      });
      return;
    }

    if (activeTab === TAB_AUDITORIA) {
      setAuditoriaFiltros({
        busca: "",
        dataInicio: "",
        dataFim: "",
      });
      return;
    }

    setEstoqueFiltros({
      busca: "",
      situacao: "",
      dataInicio: "",
      dataFim: "",
    });
  }

  async function abrirNovoFormulario() {
    if (activeTab === TAB_TROCA) {
      const rowsRef = trocas.length ? trocas : await carregarTrocas();
      setTrocaForm(createTrocaForm(buildNextFicha(rowsRef, "ficha_troca", "TP"), userName));
      setTrocaOpen(true);
      return;
    }

    if (activeTab === TAB_AUDITORIA) {
      const rowsRef = auditorias.length ? auditorias : await carregarAuditorias();
      setAuditoriaForm(createAuditoriaForm(buildNextFicha(rowsRef, "ficha_auditoria", "AP"), userName));
      setAuditoriaOpen(true);
      return;
    }

    const rowsRef = estoqueRows.length ? estoqueRows : await carregarEstoque();
    setEstoqueForm(createEstoqueForm(buildNextFicha(rowsRef, "ficha_estoque", "EP"), userName));
    setEstoqueOpen(true);
  }

  function updateTrocaField(field, value) {
    setTrocaForm((current) => {
      if (field === "tipoTroca" && value === TIPO_TROCA_ESTOQUE) {
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

  function updateTrocaFoto(field, file) {
    setTrocaForm((current) => ({ ...current, [field]: file }));
  }

  function updateAuditoriaField(field, value) {
    setAuditoriaForm((current) => ({ ...current, [field]: value }));
  }

  function updateAuditoriaPosicao(index, field, value) {
    setAuditoriaForm((current) => ({
      ...current,
      posicoes: current.posicoes.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item
      ),
    }));
  }

  function updateEstoqueField(field, value) {
    setEstoqueForm((current) => ({ ...current, [field]: value }));
  }

  async function salvarTroca() {
    const ficha = safeText(trocaForm.ficha);
    const tipoTroca = safeText(trocaForm.tipoTroca);
    const prefixoInstalacao = safeText(trocaForm.prefixoInstalacao);
    const posicaoInstalacao = safeText(trocaForm.posicaoInstalacao);
    const numeroFogoRetirado = safeText(trocaForm.numeroFogoRetirado);
    const numeroFogoColocado = safeText(trocaForm.numeroFogoColocado);
    const observacoes = safeText(trocaForm.observacoes);

    const isEstoqueCarro = tipoTroca === TIPO_TROCA_ESTOQUE;
    const prefixoRetirada = isEstoqueCarro ? prefixoInstalacao : safeText(trocaForm.prefixoRetirada);
    const posicaoRetirada = isEstoqueCarro ? posicaoInstalacao : safeText(trocaForm.posicaoRetirada);

    if (!ficha || !tipoTroca || !prefixoInstalacao || !posicaoInstalacao || !numeroFogoRetirado || !numeroFogoColocado) {
      alert("Preencha os campos obrigatorios da troca.");
      return;
    }

    if (!prefixoRetirada || !posicaoRetirada) {
      alert("Preencha os dados do pneu retirado.");
      return;
    }

    if (!trocaForm.fotoRetirado || !trocaForm.fotoColocado) {
      alert("As duas fotos do numero do pneu sao obrigatorias.");
      return;
    }

    try {
      setSaving(true);
      const trocaId = createClientUuid();
      const fotoRetirada = await uploadFoto(BUCKET_TROCA, "trocas", trocaId, "numero_retirado", trocaForm.fotoRetirado);
      const fotoColocada = await uploadFoto(BUCKET_TROCA, "trocas", trocaId, "numero_colocado", trocaForm.fotoColocado);

      const payload = {
        id: trocaId,
        ficha_troca: ficha,
        prefixo: prefixoInstalacao,
        posicao: posicaoInstalacao,
        tipo_troca: tipoTroca,
        prefixo_retirada: prefixoRetirada,
        posicao_retirada: posicaoRetirada,
        numero_fogo_retirado: numeroFogoRetirado,
        foto_numero_fogo_retirado_path: fotoRetirada.path,
        foto_numero_fogo_retirado_url: fotoRetirada.url,
        prefixo_instalacao: prefixoInstalacao,
        posicao_instalacao: posicaoInstalacao,
        numero_fogo_colocado: numeroFogoColocado,
        foto_numero_fogo_colocado_path: fotoColocada.path,
        foto_numero_fogo_colocado_url: fotoColocada.url,
        numero_fogo_pneu: numeroFogoColocado,
        foto_numero_fogo_path: fotoColocada.path,
        foto_numero_fogo_url: fotoColocada.url,
        observacoes,
        criado_por_login: safeText(user?.login || user?.email),
        criado_por_nome: safeText(user?.nome),
        criado_por_id: safeText(user?.auth_user_id || user?.id),
        origem: "INOVE_WEB_APP",
      };

      const { error } = await supabase.from("pcm_troca_pneus").insert([payload]);
      if (error) throw error;

      setTrocaOpen(false);
      const data = await carregarTrocas();
      setTrocaForm(createTrocaForm(buildNextFicha(data, "ficha_troca", "TP"), userName));
      alert("Ficha de troca salva com sucesso.");
    } catch (error) {
      console.error("Erro ao salvar troca de pneus:", error);
      alert(error?.message || "Nao foi possivel salvar a troca.");
    } finally {
      setSaving(false);
    }
  }

  async function salvarAuditoria() {
    const ficha = safeText(auditoriaForm.ficha);
    const prefixo = safeText(auditoriaForm.prefixo);
    const observacoes = safeText(auditoriaForm.observacoes);

    if (!ficha || !prefixo) {
      alert("Preencha ficha e prefixo da auditoria.");
      return;
    }

    const hasInvalidPosition = auditoriaForm.posicoes.some(
      (item) => !safeText(item.numeroFogo) || !item.foto
    );

    if (hasInvalidPosition) {
      alert("Preencha numero de fogo e foto de todas as posicoes.");
      return;
    }

    try {
      setSaving(true);
      const auditoriaId = createClientUuid();
      const posicoes = [];

      for (let index = 0; index < auditoriaForm.posicoes.length; index += 1) {
        const item = auditoriaForm.posicoes[index];
        const uploaded = await uploadFoto(
          BUCKET_AUDITORIA,
          "auditorias",
          auditoriaId,
          `posicao_${index + 1}`,
          item.foto
        );

        posicoes.push({
          posicao: item.posicao,
          numero_fogo: safeText(item.numeroFogo),
          foto_path: uploaded.path,
          foto_url: uploaded.url,
        });
      }

      const payload = {
        id: auditoriaId,
        ficha_auditoria: ficha,
        prefixo,
        posicoes,
        observacoes,
        criado_por_login: safeText(user?.login || user?.email),
        criado_por_nome: safeText(user?.nome),
        criado_por_id: safeText(user?.auth_user_id || user?.id),
        origem: "INOVE_WEB_APP",
      };

      const { error } = await supabase.from("pcm_auditoria_pneus").insert([payload]);
      if (error) throw error;

      setAuditoriaOpen(false);
      const data = await carregarAuditorias();
      setAuditoriaForm(createAuditoriaForm(buildNextFicha(data, "ficha_auditoria", "AP"), userName));
      alert("Auditoria salva com sucesso.");
    } catch (error) {
      console.error("Erro ao salvar auditoria:", error);
      alert(error?.message || "Nao foi possivel salvar a auditoria.");
    } finally {
      setSaving(false);
    }
  }

  async function salvarEstoque() {
    const ficha = safeText(estoqueForm.ficha);
    const numeroPneu = safeText(estoqueForm.numeroPneu);
    const marca = safeText(estoqueForm.marca);
    const situacao = safeText(estoqueForm.situacao);
    const observacoes = safeText(estoqueForm.observacoes);

    if (!ficha || !numeroPneu || !marca || !situacao) {
      alert("Preencha os campos obrigatorios do estoque.");
      return;
    }

    try {
      setSaving(true);
      const payload = {
        id: createClientUuid(),
        ficha_estoque: ficha,
        numero_pneu: numeroPneu,
        marca,
        situacao,
        observacoes,
        criado_por_login: safeText(user?.login || user?.email),
        criado_por_nome: safeText(user?.nome),
        criado_por_id: safeText(user?.auth_user_id || user?.id),
        origem: "INOVE_WEB_APP",
      };

      const { error } = await supabase.from("pcm_estoque_pneus").insert([payload]);
      if (error) throw error;

      setEstoqueOpen(false);
      const data = await carregarEstoque();
      setEstoqueForm(createEstoqueForm(buildNextFicha(data, "ficha_estoque", "EP"), userName));
      alert("Estoque salvo com sucesso.");
    } catch (error) {
      console.error("Erro ao salvar estoque:", error);
      alert(error?.message || "Nao foi possivel salvar o estoque.");
    } finally {
      setSaving(false);
    }
  }

  async function marcarTransnet() {
    const row = consulta.row;
    if (!row?.id || row.transnet_lancado_em) return;

    try {
      setTransnetSaving(true);

      const payload = {
        transnet_lancado_em: new Date().toISOString(),
        transnet_lancado_por_login: safeText(user?.login || user?.email),
        transnet_lancado_por_nome: safeText(user?.nome),
        transnet_lancado_por_id: safeText(user?.auth_user_id || user?.id),
      };

      const { error } = await supabase.from("pcm_troca_pneus").update(payload).eq("id", row.id);
      if (error) throw error;

      const updatedRow = { ...row, ...payload };
      setTrocas((current) => current.map((item) => (item.id === row.id ? updatedRow : item)));
      setConsulta((current) => ({ ...current, row: updatedRow }));
      alert("Lancamento no Transnet gravado com sucesso.");
    } catch (error) {
      console.error("Erro ao marcar Transnet:", error);
      alert(error?.message || "Nao foi possivel gravar o lancamento no Transnet.");
    } finally {
      setTransnetSaving(false);
    }
  }

  function exportarExcel() {
    const wb = XLSX.utils.book_new();

    if (activeTab === TAB_TROCA) {
      const sheet = trocasFiltradas.map((row) => ({
        ficha: row.ficha_troca,
        data: formatDate(row.created_at),
        quem_lancou: row.criado_por_nome || row.criado_por_login,
        tipo_troca: row.tipo_troca,
        prefixo_retirada: row.prefixo_retirada,
        posicao_retirada: row.posicao_retirada,
        numero_retirado: row.numero_fogo_retirado,
        prefixo_colocado: row.prefixo_instalacao,
        posicao_colocada: row.posicao_instalacao,
        numero_colocado: row.numero_fogo_colocado,
        transnet_lancado_em: row.transnet_lancado_em ? formatDate(row.transnet_lancado_em) : "",
        transnet_lancado_por: row.transnet_lancado_por_nome || row.transnet_lancado_por_login || "",
        observacoes: row.observacoes || "",
      }));

      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheet), "Troca de pneus");
      XLSX.writeFile(wb, "pcm_troca_pneus.xlsx");
      return;
    }

    if (activeTab === TAB_AUDITORIA) {
      const sheet = auditoriasFiltradas.map((row) => {
        const base = {
          ficha: row.ficha_auditoria,
          data: formatDate(row.created_at),
          quem_lancou: row.criado_por_nome || row.criado_por_login,
          prefixo: row.prefixo,
          observacoes: row.observacoes || "",
        };

        getAuditoriaPosicoes(row).forEach((item) => {
          const key = item.posicao.toLowerCase().replace(/[^\w]+/g, "_");
          base[`${key}_numero`] = item.numero_fogo || "";
          base[`${key}_foto`] = item.foto_url || "";
        });

        return base;
      });

      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheet), "Auditoria");
      XLSX.writeFile(wb, "pcm_auditoria_pneus.xlsx");
      return;
    }

    const sheet = estoqueFiltrado.map((row) => ({
      ficha: row.ficha_estoque,
      data: formatDate(row.created_at),
      quem_lancou: row.criado_por_nome || row.criado_por_login,
      numero_pneu: row.numero_pneu,
      marca: row.marca,
      situacao: row.situacao,
      observacoes: row.observacoes || "",
    }));

    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheet), "Estoque");
    XLSX.writeFile(wb, "pcm_estoque_pneus.xlsx");
  }

  const actionLabel =
    activeTab === TAB_TROCA
      ? "Lancar troca de pneus"
      : activeTab === TAB_AUDITORIA
        ? "Lancar auditoria de pneus"
        : "Lancar estoque de pneus";

  return (
    <div className="mx-auto min-h-screen max-w-7xl space-y-6 bg-slate-50 p-4 md:p-6">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-800">
            <FaClipboardList className="text-blue-600" />
            Central de Pneus PCM
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Troca, auditoria e estoque em uma central so, com filtros e exportacao.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={exportarExcel}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
          >
            <FaDownload />
            Baixar Excel
          </button>
          <button
            type="button"
            onClick={abrirNovoFormulario}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
          >
            <FaPlus />
            {actionLabel}
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-3 overflow-x-auto pb-1 sm:flex-row">
        <TabButton
          active={activeTab === TAB_TROCA}
          onClick={() => setActiveTab(TAB_TROCA)}
          icon={<FaClipboardList className="text-blue-600" />}
          title="Troca de pneus"
          count={trocas.length}
        />
        <TabButton
          active={activeTab === TAB_AUDITORIA}
          onClick={() => setActiveTab(TAB_AUDITORIA)}
          icon={<FaClipboardCheck className="text-violet-600" />}
          title="Auditoria de pneus"
          count={auditorias.length}
        />
        <TabButton
          active={activeTab === TAB_ESTOQUE}
          onClick={() => setActiveTab(TAB_ESTOQUE)}
          icon={<FaWarehouse className="text-amber-600" />}
          title="Estoque de pneus"
          count={estoqueRows.length}
        />
      </div>

      {activeTab === TAB_TROCA ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
          <CardResumo label="Total" value={cardsTroca.total} color="text-slate-900" />
          <CardResumo label="Estoque -> Carro" value={cardsTroca.estoqueCarro} color="text-blue-600" />
          <CardResumo label="Carro -> Carro" value={cardsTroca.carroCarro} color="text-orange-600" />
          <CardResumo label="Transnet" value={cardsTroca.transnet} color="text-emerald-600" />
          <CardResumo label="Hoje" value={cardsTroca.hoje} color="text-violet-600" />
        </div>
      ) : null}

      {activeTab === TAB_AUDITORIA ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <CardResumo label="Total" value={cardsAuditoria.total} color="text-slate-900" />
          <CardResumo label="Hoje" value={cardsAuditoria.hoje} color="text-blue-600" />
          <CardResumo label="Prefixos" value={cardsAuditoria.prefixos} color="text-violet-600" />
          <CardResumo label="Completas" value={cardsAuditoria.completas} color="text-emerald-600" />
        </div>
      ) : null}

      {activeTab === TAB_ESTOQUE ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
          <CardResumo label="Total" value={cardsEstoque.total} color="text-slate-900" />
          <CardResumo label="Novo" value={cardsEstoque.novo} color="text-blue-600" />
          <CardResumo label="Para uso" value={cardsEstoque.uso} color="text-emerald-600" />
          <CardResumo label="Recapagem" value={cardsEstoque.recapagem} color="text-amber-600" />
          <CardResumo label="Sucata" value={cardsEstoque.sucata} color="text-rose-600" />
        </div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-800">Filtros</h2>

        {activeTab === TAB_TROCA ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
            <div className="relative md:col-span-2">
              <FaSearch className="absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar ficha, prefixo ou numero do pneu..."
                value={trocaFiltros.busca}
                onChange={(event) => setTrocaFiltros((current) => ({ ...current, busca: event.target.value }))}
                className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-10 pr-3 text-sm text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            <input
              type="date"
              value={trocaFiltros.dataInicio}
              onChange={(event) => setTrocaFiltros((current) => ({ ...current, dataInicio: event.target.value }))}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
            <input
              type="date"
              value={trocaFiltros.dataFim}
              onChange={(event) => setTrocaFiltros((current) => ({ ...current, dataFim: event.target.value }))}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
            <SelectField
              label="Tipo"
              value={trocaFiltros.tipoTroca}
              onChange={(value) => setTrocaFiltros((current) => ({ ...current, tipoTroca: value }))}
              options={["", TIPO_TROCA_ESTOQUE, TIPO_TROCA_CARRO]}
            />
            <SelectField
              label="Transnet"
              value={trocaFiltros.transnet}
              onChange={(value) => setTrocaFiltros((current) => ({ ...current, transnet: value }))}
              options={["", "sim", "nao"]}
            />
          </div>
        ) : null}

        {activeTab === TAB_AUDITORIA ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="relative md:col-span-2">
              <FaSearch className="absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar ficha, prefixo ou numero de fogo..."
                value={auditoriaFiltros.busca}
                onChange={(event) => setAuditoriaFiltros((current) => ({ ...current, busca: event.target.value }))}
                className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-10 pr-3 text-sm text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            <input
              type="date"
              value={auditoriaFiltros.dataInicio}
              onChange={(event) => setAuditoriaFiltros((current) => ({ ...current, dataInicio: event.target.value }))}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
            <input
              type="date"
              value={auditoriaFiltros.dataFim}
              onChange={(event) => setAuditoriaFiltros((current) => ({ ...current, dataFim: event.target.value }))}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
        ) : null}

        {activeTab === TAB_ESTOQUE ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
            <div className="relative md:col-span-2">
              <FaSearch className="absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar ficha, numero do pneu ou marca..."
                value={estoqueFiltros.busca}
                onChange={(event) => setEstoqueFiltros((current) => ({ ...current, busca: event.target.value }))}
                className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-10 pr-3 text-sm text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            <input
              type="date"
              value={estoqueFiltros.dataInicio}
              onChange={(event) => setEstoqueFiltros((current) => ({ ...current, dataInicio: event.target.value }))}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
            <input
              type="date"
              value={estoqueFiltros.dataFim}
              onChange={(event) => setEstoqueFiltros((current) => ({ ...current, dataFim: event.target.value }))}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
            <SelectField
              label="Situacao"
              value={estoqueFiltros.situacao}
              onChange={(value) => setEstoqueFiltros((current) => ({ ...current, situacao: value }))}
              options={["", ...SITUACOES_ESTOQUE]}
            />
          </div>
        ) : null}

        <div className="mt-4 flex justify-end gap-3">
          <button
            type="button"
            onClick={limparFiltrosAtivos}
            className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200"
          >
            Limpar
          </button>
          <button
            type="button"
            onClick={aplicar}
            disabled={loading}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {loading ? "Atualizando..." : "Atualizar"}
          </button>
        </div>
      </div>

      {activeTab === TAB_TROCA ? (
        isNativeShell ? (
          <div className="space-y-3">
            {!loading && trocasFiltradas.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white px-6 py-8 text-center text-slate-500 shadow-sm">
                Nenhuma ficha encontrada com os filtros atuais.
              </div>
            ) : (
              trocasFiltradas.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => openConsulta(TAB_TROCA, row)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-left shadow-sm transition hover:border-blue-200 hover:bg-blue-50/40"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-bold text-slate-900">Prefixo {row.prefixo_instalacao || row.prefixo || "-"}</div>
                      <div className="mt-1 text-xs text-slate-500">{row.transnet_lancado_em ? "Lancado no Transnet" : "Pendente Transnet"}</div>
                    </div>
                    <div className="text-right text-xs text-slate-500">{formatDate(row.created_at)}</div>
                  </div>
                </button>
              ))
            )}
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Ficha</th>
                    <th className="px-4 py-3">Data</th>
                    <th className="px-4 py-3">Quem lancou</th>
                    <th className="px-4 py-3">Tipo</th>
                    <th className="px-4 py-3">Resumo</th>
                    <th className="px-4 py-3">Transnet</th>
                    <th className="px-4 py-3 text-right">Acoes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {!loading && trocasFiltradas.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-8 text-center text-slate-500">
                        Nenhuma ficha encontrada com os filtros atuais.
                      </td>
                    </tr>
                  ) : (
                    trocasFiltradas.map((row) => (
                      <tr key={row.id} className="transition-colors hover:bg-slate-50/80">
                        <td className="px-4 py-3 font-bold text-slate-700">{row.ficha_troca}</td>
                        <td className="px-4 py-3 text-slate-600">{formatDate(row.created_at)}</td>
                        <td className="px-4 py-3 font-medium text-slate-700">{row.criado_por_nome || row.criado_por_login || "-"}</td>
                        <td className="px-4 py-3 text-slate-600">{row.tipo_troca || "-"}</td>
                        <td className="px-4 py-3 text-slate-600">{buildTrocaResumo(row)}</td>
                        <td className="px-4 py-3 text-slate-600">
                          {row.transnet_lancado_em ? formatDate(row.transnet_lancado_em) : "Pendente"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => openConsulta(TAB_TROCA, row)}
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
        )
      ) : null}

      {activeTab === TAB_AUDITORIA ? (
        isNativeShell ? (
          <div className="space-y-3">
            {!loading && auditoriasFiltradas.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white px-6 py-8 text-center text-slate-500 shadow-sm">
                Nenhuma auditoria encontrada com os filtros atuais.
              </div>
            ) : (
              auditoriasFiltradas.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => openConsulta(TAB_AUDITORIA, row)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-left shadow-sm transition hover:border-violet-200 hover:bg-violet-50/40"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-bold text-slate-900">Prefixo {row.prefixo || "-"}</div>
                      <div className="mt-1 text-xs text-slate-500">{buildAuditoriaResumo(row)}</div>
                    </div>
                    <div className="text-right text-xs text-slate-500">{formatDate(row.created_at)}</div>
                  </div>
                </button>
              ))
            )}
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Ficha</th>
                    <th className="px-4 py-3">Data</th>
                    <th className="px-4 py-3">Prefixo</th>
                    <th className="px-4 py-3">Quem lancou</th>
                    <th className="px-4 py-3">Resumo</th>
                    <th className="px-4 py-3 text-right">Acoes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {!loading && auditoriasFiltradas.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                        Nenhuma auditoria encontrada com os filtros atuais.
                      </td>
                    </tr>
                  ) : (
                    auditoriasFiltradas.map((row) => (
                      <tr key={row.id} className="transition-colors hover:bg-slate-50/80">
                        <td className="px-4 py-3 font-bold text-slate-700">{row.ficha_auditoria}</td>
                        <td className="px-4 py-3 text-slate-600">{formatDate(row.created_at)}</td>
                        <td className="px-4 py-3 font-medium text-slate-700">{row.prefixo}</td>
                        <td className="px-4 py-3 text-slate-600">{row.criado_por_nome || row.criado_por_login || "-"}</td>
                        <td className="px-4 py-3 text-slate-600">{buildAuditoriaResumo(row)}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => openConsulta(TAB_AUDITORIA, row)}
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
        )
      ) : null}

      {activeTab === TAB_ESTOQUE ? (
        isNativeShell ? (
          <div className="space-y-3">
            {!loading && estoqueFiltrado.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white px-6 py-8 text-center text-slate-500 shadow-sm">
                Nenhum item de estoque encontrado com os filtros atuais.
              </div>
            ) : (
              estoqueFiltrado.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => openConsulta(TAB_ESTOQUE, row)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-left shadow-sm transition hover:border-amber-200 hover:bg-amber-50/40"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-bold text-slate-900">Pneu {row.numero_pneu || "-"}</div>
                      <div className="mt-1 text-xs text-slate-500">{row.situacao || "-"}</div>
                    </div>
                    <div className="text-right text-xs text-slate-500">{formatDate(row.created_at)}</div>
                  </div>
                </button>
              ))
            )}
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Ficha</th>
                    <th className="px-4 py-3">Data</th>
                    <th className="px-4 py-3">Numero do pneu</th>
                    <th className="px-4 py-3">Marca</th>
                    <th className="px-4 py-3">Situacao</th>
                    <th className="px-4 py-3">Quem lancou</th>
                    <th className="px-4 py-3 text-right">Acoes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {!loading && estoqueFiltrado.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-8 text-center text-slate-500">
                        Nenhum item de estoque encontrado com os filtros atuais.
                      </td>
                    </tr>
                  ) : (
                    estoqueFiltrado.map((row) => (
                      <tr key={row.id} className="transition-colors hover:bg-slate-50/80">
                        <td className="px-4 py-3 font-bold text-slate-700">{row.ficha_estoque}</td>
                        <td className="px-4 py-3 text-slate-600">{formatDate(row.created_at)}</td>
                        <td className="px-4 py-3 font-medium text-slate-700">{row.numero_pneu}</td>
                        <td className="px-4 py-3 text-slate-600">{row.marca}</td>
                        <td className="px-4 py-3 text-slate-600">{row.situacao}</td>
                        <td className="px-4 py-3 text-slate-600">{row.criado_por_nome || row.criado_por_login || "-"}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => openConsulta(TAB_ESTOQUE, row)}
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
        )
      ) : null}

      <TrocaModal
        open={trocaOpen}
        form={trocaForm}
        saving={saving}
        onClose={() => setTrocaOpen(false)}
        onFieldChange={updateTrocaField}
        onFotoChange={updateTrocaFoto}
        onSalvar={salvarTroca}
      />

      <AuditoriaModal
        open={auditoriaOpen}
        form={auditoriaForm}
        saving={saving}
        onClose={() => setAuditoriaOpen(false)}
        onFieldChange={updateAuditoriaField}
        onPosicaoChange={updateAuditoriaPosicao}
        onSalvar={salvarAuditoria}
      />

      <EstoqueModal
        open={estoqueOpen}
        form={estoqueForm}
        saving={saving}
        onClose={() => setEstoqueOpen(false)}
        onFieldChange={updateEstoqueField}
        onSalvar={salvarEstoque}
      />

      <ConsultaModal
        open={consulta.open}
        tab={consulta.tab}
        row={consulta.row}
        transnetSaving={transnetSaving}
        onClose={closeConsulta}
        onMarcarTransnet={marcarTransnet}
      />
    </div>
  );
}
