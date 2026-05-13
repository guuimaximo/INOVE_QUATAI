import { useContext, useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { Capacitor } from "@capacitor/core";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { App as CapacitorApp } from "@capacitor/app";
import { LocalNotifications } from "@capacitor/local-notifications";
import { useSearchParams } from "react-router-dom";
import {
  FaBell,
  FaCamera,
  FaCheckCircle,
  FaClipboardCheck,
  FaClipboardList,
  FaDownload,
  FaEye,
  FaExclamationTriangle,
  FaHistory,
  FaPlus,
  FaSave,
  FaSearch,
  FaTimes,
  FaTools,
  FaWarehouse,
  FaWrench,
} from "react-icons/fa";

import { AuthContext } from "../../context/AuthContext";
import { useMobileTabBadges } from "../../context/MobileTabBadgesContext";
import CampoPrefixo from "../../components/CampoPrefixo";
import { supabase } from "../../supabase";
import {
  base64ToFile,
  enqueueSubmission,
  listSubmissions,
  removeSubmission,
  serializeFile,
} from "../../utils/pcmOfflineQueue";

const TAB_TROCA = "troca";
const TAB_AUDITORIA = "auditoria";
const TAB_ESTOQUE = "estoque";
const TAB_CONSERTOS = "consertos";
const TAB_RISCADOS = "riscados";

const BUCKET_TROCA = "pcm_troca_pneus";
const BUCKET_AUDITORIA = "pcm_auditoria_pneus";
const BUCKET_RISCADOS = "pcm_riscados_pneus";

const TIPO_TROCA_ESTOQUE = "ESTOQUE -> CARRO";
const TIPO_TROCA_CARRO = "CARRO -> CARRO";
const TROCA_CONSERTO_NENHUM = "NAO ENVIAR";
const TROCA_CONSERTO_RETIRADO = "PNEU RETIRADO";
const TROCA_CONSERTO_COLOCADO = "PNEU COLOCADO";
const TROCA_CONSERTO_OPTIONS = [
  TROCA_CONSERTO_NENHUM,
  TROCA_CONSERTO_RETIRADO,
  TROCA_CONSERTO_COLOCADO,
];

const ORIGEM_RECEBEU_SEM_PNEU = "FICOU SEM PNEU";
const ORIGEM_RECEBEU_DO_DESTINO = "RECEBEU O PNEU DO CARRO DE DESTINO";
const ORIGEM_RECEBEU_OUTRO = "RECEBEU OUTRO PNEU";
const ORIGEM_RECEBEU_OPTIONS = [
  ORIGEM_RECEBEU_SEM_PNEU,
  ORIGEM_RECEBEU_DO_DESTINO,
  ORIGEM_RECEBEU_OUTRO,
];

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

const SITUACOES_CONSERTO = ["PENDENTE", "EM CONSERTO", "CONCLUIDO"];
const SITUACOES_RISCADO = ["ABERTO", "ACOMPANHANDO", "RESOLVIDO"];

const MARCAS_PNEU = ["Michelin", "Goodyear", "Pirelli", "Outra"];

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

function isTabValue(value) {
  return (
    value === TAB_TROCA ||
    value === TAB_AUDITORIA ||
    value === TAB_ESTOQUE ||
    value === TAB_CONSERTOS ||
    value === TAB_RISCADOS
  );
}

function base64ToUint8Array(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function nowDisplay() {
  return formatDate(new Date().toISOString());
}

function todayValue() {
  return new Date().toISOString().slice(0, 10);
}

function parseDateValue(value) {
  if (!value) return null;
  const next = new Date(value);
  return Number.isNaN(next.getTime()) ? null : next;
}

function diffDaysFromToday(value) {
  const start = parseDateValue(value);
  if (!start) return 0;
  const now = new Date();
  const startUtc = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const nowUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(0, Math.floor((nowUtc - startUtc) / 86400000));
}

function buildAlertCycle(days) {
  if (days < 10) return 0;
  return Math.floor(days / 10);
}

function buildNotificationId(seed = "") {
  let hash = 0;
  const text = String(seed || Date.now());
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) % 2147483647;
  }
  return Math.max(1, hash);
}

async function notifyDevice({ title, body, seed }) {
  if (!title || !body) return;

  if (Capacitor.isNativePlatform()) {
    try {
      const permissions = await LocalNotifications.requestPermissions();
      if (permissions.display !== "granted") return;

      await LocalNotifications.schedule({
        notifications: [
          {
            id: buildNotificationId(seed),
            title,
            body,
            schedule: { at: new Date(Date.now() + 1000) },
          },
        ],
      });
      return;
    } catch (error) {
      console.error("Erro ao agendar notificacao local:", error);
    }
  }

  if (typeof window !== "undefined" && "Notification" in window) {
    try {
      if (Notification.permission === "default") {
        await Notification.requestPermission();
      }
      if (Notification.permission === "granted") {
        new Notification(title, { body });
      }
    } catch (error) {
      console.error("Erro ao emitir notificacao web:", error);
    }
  }
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
    calibragem: "",
    sulco: "",
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
    pneuConserto: TROCA_CONSERTO_NENHUM,
    origemRecebeu: ORIGEM_RECEBEU_SEM_PNEU,
    numeroFogoOrigemRecebido: "",
    fotoOrigemRecebido: null,
    observacoes: "",
  };
}

function buildTrocaConsertoResumo(value) {
  if (value === TROCA_CONSERTO_RETIRADO) return "Pneu retirado";
  if (value === TROCA_CONSERTO_COLOCADO) return "Pneu colocado";
  return "";
}

function resolveTrocaConsertoPayload(payload) {
  if (payload.pneuConserto === TROCA_CONSERTO_RETIRADO) {
    return {
      id: payload.consertoId || createClientUuid(),
      ficha: payload.consertoFicha || `CP-${payload.ficha}`,
      origemTab: TAB_TROCA,
      origemItemId: payload.id,
      prefixo: payload.prefixoRetirada,
      numeroFogo: payload.numeroFogoRetirado,
      situacaoOrigem: "Troca - pneu retirado",
      observacoes: payload.observacoes,
      criadoPorLogin: payload.criadoPorLogin,
      criadoPorNome: payload.criadoPorNome,
      criadoPorId: payload.criadoPorId,
    };
  }

  if (payload.pneuConserto === TROCA_CONSERTO_COLOCADO) {
    return {
      id: payload.consertoId || createClientUuid(),
      ficha: payload.consertoFicha || `CP-${payload.ficha}`,
      origemTab: TAB_TROCA,
      origemItemId: payload.id,
      prefixo: payload.prefixoInstalacao,
      numeroFogo: payload.numeroFogoColocado,
      situacaoOrigem: "Troca - pneu colocado",
      observacoes: payload.observacoes,
      criadoPorLogin: payload.criadoPorLogin,
      criadoPorNome: payload.criadoPorNome,
      criadoPorId: payload.criadoPorId,
    };
  }

  return null;
}

function resolveConsertoSourceMeta(row, trocas, auditorias) {
  if (!row) return null;

  if (row.origem_tab === TAB_AUDITORIA) {
    const [auditoriaId, posicao] = String(row.origem_item_id || "").split(":");
    const auditoria = (auditorias || []).find((item) => String(item.id) === String(auditoriaId));
    const posicaoAuditoria = getAuditoriaPosicoes(auditoria).find((item) => String(item.posicao) === String(posicao));
    return {
      fichaOrigem: auditoria?.ficha_auditoria || "",
      origemResumo: auditoria ? `Auditoria ${auditoria.ficha_auditoria || "-"} · ${posicao || "-"}` : "",
      fotoUrl: posicaoAuditoria?.foto_url || "",
      fotoAlt: posicao ? `Auditoria ${posicao}` : "Foto da auditoria",
    };
  }

  if (row.origem_tab === TAB_TROCA) {
    const troca = (trocas || []).find((item) => String(item.id) === String(row.origem_item_id));
    const situacao = norm(row.situacao_origem).toLowerCase();
    const isRetirado =
      situacao.includes("retirado") || norm(row.numero_fogo) === norm(troca?.numero_fogo_retirado);
    const fotoUrl = isRetirado
      ? troca?.foto_numero_fogo_retirado_url || ""
      : troca?.foto_numero_fogo_colocado_url || troca?.foto_numero_fogo_url || "";
    return {
      fichaOrigem: troca?.ficha_troca || "",
      origemResumo: troca ? `Troca ${troca.ficha_troca || "-"} · ${isRetirado ? "Pneu retirado" : "Pneu colocado"}` : "",
      fotoUrl,
      fotoAlt: isRetirado ? "Numero de fogo retirado" : "Numero de fogo colocado",
    };
  }

  return null;
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

function createEstoqueItem() {
  return {
    numeroPneu: "",
    numeroFogo: "",
    marca: MARCAS_PNEU[0],
    marcaOutra: "",
    situacao: SITUACOES_ESTOQUE[0],
  };
}

function createEstoqueForm(nextFicha, userName) {
  return {
    ficha: nextFicha,
    dataLancamento: nowDisplay(),
    quemLancou: userName,
    itens: [createEstoqueItem()],
    observacoes: "",
  };
}

function createConsertoForm(nextFicha, userName) {
  return {
    ficha: nextFicha,
    dataLancamento: nowDisplay(),
    quemLancou: userName,
    origemTab: TAB_AUDITORIA,
    origemItemId: "",
    prefixo: "",
    numeroFogo: "",
    situacaoOrigem: "",
    observacoes: "",
  };
}

function createRiscadoForm(nextFicha, userName) {
  return {
    ficha: nextFicha,
    dataLancamento: nowDisplay(),
    quemLancou: userName,
    dataRiscado: todayValue(),
    prefixo: "",
    numeroFogo: "",
    marca: MARCAS_PNEU[0],
    marcaOutra: "",
    mmAntes: "",
    mmDepois: "",
    observacoes: "",
    foto: null,
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

async function captureNativePhoto(fileNamePrefix) {
  const permissions = await Camera.checkPermissions();
  const hasCameraPermission =
    permissions.camera === "granted" || permissions.camera === "limited";

  if (!hasCameraPermission) {
    const requested = await Camera.requestPermissions({ permissions: ["camera"] });
    const granted = requested.camera === "granted" || requested.camera === "limited";
    if (!granted) {
      throw new Error("Permissao da camera negada.");
    }
  }

  const photo = await Camera.getPhoto({
    source: CameraSource.Camera,
    resultType: CameraResultType.Base64,
    quality: 80,
    promptLabelHeader: "Foto do pneu",
    promptLabelPhoto: "Galeria",
    promptLabelPicture: "Camera",
  });

  if (!photo?.base64String) return null;

  const extension = photo.format || "jpg";
  const mimeType = photo.format ? `image/${photo.format}` : "image/jpeg";
  const bytes = base64ToUint8Array(photo.base64String);
  return new File([bytes], `${fileNamePrefix}.${extension}`, { type: mimeType });
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

function getAuditoriaConferenciaCounts(row) {
  const counts = new Map();

  for (const item of getAuditoriaPosicoes(row)) {
    const key = norm(item.conferencia_status) || "Pendente";
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  return [...counts.entries()].map(([label, value]) => ({ label, value }));
}

function isAuditoriaConcluida(row) {
  const posicoes = getAuditoriaPosicoes(row);
  return posicoes.length === POSICOES.length && posicoes.every((item) => !!norm(item.conferencia_status));
}

function hasAuditoriaIncorreta(row) {
  return getAuditoriaPosicoes(row).some((item) => norm(item.conferencia_status) === "INCORRETO");
}

function getEstoqueSituacaoCounts(row) {
  const counts = new Map();

  for (const item of row?.itens || []) {
    const key = norm(item.situacao) || "Sem situacao";
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  return [...counts.entries()].map(([label, value]) => ({ label, value }));
}

function getEstoqueConferenciaCounts(row) {
  const counts = new Map();

  for (const item of row?.itens || []) {
    const key = norm(item.transnet_status) || "Pendente";
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  return [...counts.entries()].map(([label, value]) => ({ label, value }));
}

function getConsertoStatusCounts(rows) {
  const counts = new Map();

  for (const row of rows || []) {
    const key = norm(row.status) || "PENDENTE";
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  return [...counts.entries()].map(([label, value]) => ({ label, value }));
}

function getRiscadoStatusCounts(rows) {
  const counts = new Map();

  for (const row of rows || []) {
    const key = norm(row.status) || "ABERTO";
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  return [...counts.entries()].map(([label, value]) => ({ label, value }));
}

function buildAuditoriaAtrasadaList(prefixos, auditorias) {
  const ultimaPorPrefixo = new Map();

  for (const row of auditorias || []) {
    const prefixo = norm(row?.prefixo);
    if (!prefixo) continue;
    const atual = parseDateValue(row.created_at);
    if (!atual) continue;

    const existente = ultimaPorPrefixo.get(prefixo);
    if (!existente || atual.getTime() > existente.getTime()) {
      ultimaPorPrefixo.set(prefixo, atual);
    }
  }

  return (prefixos || [])
    .map((item) => {
      const prefixo = norm(item?.codigo);
      if (!prefixo) return null;
      const ultima = ultimaPorPrefixo.get(prefixo) || null;
      const diasSemAuditoria = ultima ? diffDaysFromToday(ultima.toISOString()) : 9999;

      if (ultima && diasSemAuditoria <= 30) return null;

      return {
        id: item?.id || prefixo,
        prefixo,
        cluster: norm(item?.cluster),
        ultimaAuditoria: ultima ? ultima.toISOString() : "",
        diasSemAuditoria: ultima ? diasSemAuditoria : null,
        semAuditoria: !ultima,
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (a.semAuditoria && !b.semAuditoria) return -1;
      if (!a.semAuditoria && b.semAuditoria) return 1;
      return (b.diasSemAuditoria || 0) - (a.diasSemAuditoria || 0);
    });
}

function BadgeList({ items, emptyText = "-" }) {
  if (!items?.length) return <span className="text-slate-400">{emptyText}</span>;

  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <span
          key={item.label}
          className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-slate-600"
        >
          {item.label}: {item.value}
        </span>
      ))}
    </div>
  );
}

function EstoqueNumerosPreview({ row, max = 8 }) {
  const numeros = (row?.itens || [])
    .map((item) => norm(item.numero_fogo || item.numero_pneu))
    .filter(Boolean);
  const visible = numeros.slice(0, max);
  const restante = Math.max(numeros.length - visible.length, 0);

  if (!visible.length) return <span className="text-slate-400">-</span>;

  return (
    <div className="flex max-w-[360px] flex-wrap gap-1.5">
      {visible.map((numero) => (
        <span
          key={numero}
          className="inline-flex rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700"
        >
          {numero}
        </span>
      ))}
      {restante > 0 ? (
        <span className="inline-flex rounded-lg border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-bold text-blue-700">
          +{restante}
        </span>
      ) : null}
    </div>
  );
}

function isNetworkError(error) {
  const message = String(error?.message || "").toLowerCase();
  return (
    !window.navigator.onLine ||
    message.includes("network") ||
    message.includes("fetch") ||
    message.includes("failed to fetch")
  );
}

function groupEstoqueRows(rows) {
  const groups = new Map();

  for (const row of rows || []) {
    const key = norm(row.ficha_estoque) || row.id;
    const current = groups.get(key);

    if (!current) {
      groups.set(key, {
        id: key,
        ficha_estoque: row.ficha_estoque,
        created_at: row.created_at,
        criado_por_login: row.criado_por_login,
        criado_por_nome: row.criado_por_nome,
        criado_por_id: row.criado_por_id,
        observacoes: row.observacoes,
        itens: [
          {
            id: row.id,
            numero_fogo: row.numero_fogo,
            numero_pneu: row.numero_pneu,
            marca: row.marca,
            situacao: row.situacao,
            transnet_status: row.transnet_status,
            transnet_conferido_em: row.transnet_conferido_em,
            transnet_conferido_por_nome: row.transnet_conferido_por_nome,
            transnet_conferido_por_login: row.transnet_conferido_por_login,
          },
        ],
      });
      continue;
    }

    current.itens.push({
      id: row.id,
      numero_fogo: row.numero_fogo,
      numero_pneu: row.numero_pneu,
      marca: row.marca,
      situacao: row.situacao,
      transnet_status: row.transnet_status,
      transnet_conferido_em: row.transnet_conferido_em,
      transnet_conferido_por_nome: row.transnet_conferido_por_nome,
      transnet_conferido_por_login: row.transnet_conferido_por_login,
    });
  }

  return [...groups.values()].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

function CardResumo({ label, value, color, compact = false }) {
  return (
    <div className={`rounded-2xl border border-slate-200 bg-white shadow-sm ${compact ? "p-3.5" : "p-5"}`}>
      <div className={`${compact ? "text-[10px] tracking-[0.16em]" : "text-[11px] tracking-[0.22em]"} font-bold uppercase text-slate-400`}>
        {label}
      </div>
      <div className={`mt-2 font-black ${compact ? "text-2xl" : "text-3xl"} ${color}`}>{value}</div>
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

function InputField({ label, value, onChange, placeholder = "", inputMode = "text", pattern, type = "text" }) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-sm text-gray-600">{label}</span>
      <input
        type={type}
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

function PhotoField({ title, file, imageUrl = "", inputId, onChange, onNativeCapture, isNativeShell }) {
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
        onClick={() => {
          if (isNativeShell && onNativeCapture) {
            void onNativeCapture();
            return;
          }
          document.getElementById(inputId)?.click();
        }}
        className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white"
      >
        <FaCamera />
        Inserir foto
      </button>
    </div>
  );
}

function ZoomableImage({ src, alt, isNativeShell }) {
  const [open, setOpen] = useState(false);

  if (!src) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (!isNativeShell) setOpen(true);
        }}
        className={`block w-full overflow-hidden rounded-2xl border border-slate-200 ${
          isNativeShell ? "cursor-default" : "cursor-zoom-in hover:ring-2 hover:ring-blue-500/30"
        }`}
      >
        <img src={src} alt={alt} className="h-56 w-full object-cover" />
      </button>

      {!isNativeShell && open ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-sm">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="absolute right-4 top-4 rounded-xl bg-white/10 p-3 text-white transition hover:bg-white/20"
            aria-label="Fechar imagem"
          >
            <FaTimes />
          </button>
          <img
            src={src}
            alt={alt}
            className="max-h-[88vh] max-w-[95vw] rounded-2xl border border-white/20 bg-white object-contain shadow-2xl"
          />
        </div>
      ) : null}
    </>
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

function TrocaModal({
  open,
  form,
  saving,
  onClose,
  onFieldChange,
  onFotoChange,
  onCapturePhoto,
  onSalvarOffline,
  onSalvar,
  isNativeShell,
}) {
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
            onClick={onSalvarOffline}
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-60"
          >
            <FaSave />
            Salvar offline
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

          <SelectField
            label="Enviar para conserto"
            value={form.pneuConserto}
            onChange={(value) => onFieldChange("pneuConserto", value)}
            options={TROCA_CONSERTO_OPTIONS}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <InputField
            label="Observacoes"
            value={form.observacoes}
            onChange={(value) => onFieldChange("observacoes", value)}
            placeholder={
              form.pneuConserto === TROCA_CONSERTO_NENHUM
                ? "Opcional"
                : "Descreva o que precisa ser ajustado no pneu enviado ao conserto"
            }
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
                  label="Numero de fogo (retirado)"
                  value={form.numeroFogoRetirado}
                  onChange={(value) => onFieldChange("numeroFogoRetirado", value)}
                  inputMode="numeric"
                  pattern="[0-9]*"
                />
                <PhotoField
                  title="Foto do numero de fogo retirado"
                  file={form.fotoRetirado}
                  inputId="troca-retirado"
                  onChange={(event) => onFotoChange("fotoRetirado", event.target.files?.[0] || null)}
                  onNativeCapture={() => onCapturePhoto("fotoRetirado", "numero_retirado")}
                  isNativeShell={isNativeShell}
                />
              </div>

              <div className="space-y-4">
                <InputField
                  label="Numero de fogo (colocado)"
                  value={form.numeroFogoColocado}
                  onChange={(value) => onFieldChange("numeroFogoColocado", value)}
                  inputMode="numeric"
                  pattern="[0-9]*"
                />
                <PhotoField
                  title="Foto do numero de fogo colocado"
                  file={form.fotoColocado}
                  inputId="troca-colocado"
                  onChange={(event) => onFotoChange("fotoColocado", event.target.files?.[0] || null)}
                  onNativeCapture={() => onCapturePhoto("fotoColocado", "numero_colocado")}
                  isNativeShell={isNativeShell}
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
                  label="Numero de fogo (retirado)"
                  value={form.numeroFogoRetirado}
                  onChange={(value) => onFieldChange("numeroFogoRetirado", value)}
                  inputMode="numeric"
                  pattern="[0-9]*"
                />
                <PhotoField
                  title="Foto do numero de fogo retirado"
                  file={form.fotoRetirado}
                  inputId="troca-retirado"
                  onChange={(event) => onFotoChange("fotoRetirado", event.target.files?.[0] || null)}
                  onNativeCapture={() => onCapturePhoto("fotoRetirado", "numero_retirado")}
                  isNativeShell={isNativeShell}
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
                  label="Numero de fogo (colocado)"
                  value={form.numeroFogoColocado}
                  onChange={(value) => onFieldChange("numeroFogoColocado", value)}
                  inputMode="numeric"
                  pattern="[0-9]*"
                />
                <PhotoField
                  title="Foto do numero de fogo colocado"
                  file={form.fotoColocado}
                  inputId="troca-colocado"
                  onChange={(event) => onFotoChange("fotoColocado", event.target.files?.[0] || null)}
                  onNativeCapture={() => onCapturePhoto("fotoColocado", "numero_colocado")}
                  isNativeShell={isNativeShell}
                />
              </div>
            </SectionBlock>

            <div className="xl:col-span-2">
              <SectionBlock title="O que ficou no carro de origem">
                <div className="grid grid-cols-1 gap-4">
                  <SelectField
                    label="Posicao do pneu retirado no carro de origem"
                    value={form.origemRecebeu}
                    onChange={(value) => onFieldChange("origemRecebeu", value)}
                    options={ORIGEM_RECEBEU_OPTIONS}
                  />

                  {form.origemRecebeu === ORIGEM_RECEBEU_OUTRO ? (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <InputField
                        label="Numero de fogo do pneu que entrou no carro de origem"
                        value={form.numeroFogoOrigemRecebido}
                        onChange={(value) => onFieldChange("numeroFogoOrigemRecebido", value)}
                        inputMode="numeric"
                        pattern="[0-9]*"
                      />
                      <PhotoField
                        title="Foto do numero de fogo do pneu que entrou no carro de origem"
                        file={form.fotoOrigemRecebido}
                        inputId="troca-origem-recebido"
                        onChange={(event) => onFotoChange("fotoOrigemRecebido", event.target.files?.[0] || null)}
                        onNativeCapture={() => onCapturePhoto("fotoOrigemRecebido", "numero_origem_recebido")}
                        isNativeShell={isNativeShell}
                      />
                    </div>
                  ) : null}
                </div>
              </SectionBlock>
            </div>
          </div>
        )}
      </div>
    </ModalShell>
  );
}

function AuditoriaModal({
  open,
  form,
  saving,
  onClose,
  onFieldChange,
  onPosicaoChange,
  onCapturePhoto,
  onSalvarOffline,
  onSalvar,
  isNativeShell,
}) {
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
            onClick={onSalvarOffline}
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-60"
          >
            <FaSave />
            Salvar offline
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

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <InputField
                  label="Calibragem"
                  value={posicao.calibragem}
                  onChange={(value) => onPosicaoChange(index, "calibragem", value)}
                  placeholder="Ex: 100"
                  inputMode="decimal"
                />
                <InputField
                  label="Sulco"
                  value={posicao.sulco}
                  onChange={(value) => onPosicaoChange(index, "sulco", value)}
                  placeholder="Ex: 12"
                  inputMode="decimal"
                />
              </div>

              <PhotoField
                title="Foto do numero de fogo"
                file={posicao.foto}
                inputId={`auditoria-${index}`}
                onChange={(event) => onPosicaoChange(index, "foto", event.target.files?.[0] || null)}
                onNativeCapture={() => onCapturePhoto(index)}
                isNativeShell={isNativeShell}
              />
            </SectionBlock>
          ))}
        </div>
      </div>
    </ModalShell>
  );
}

function EstoqueModal({
  open,
  form,
  saving,
  onClose,
  onFieldChange,
  onItemChange,
  onAddItem,
  onRemoveItem,
  onCopiarEstoqueAnterior,
  onSalvarOffline,
  onSalvar,
}) {
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
            onClick={onSalvarOffline}
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-60"
          >
            <FaSave />
            Salvar offline
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

        <div className="sticky top-0 z-10 -mx-1 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm font-bold uppercase tracking-wide text-slate-700">Pneus do lancamento</div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={onCopiarEstoqueAnterior}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
            >
              Copiar estoque anterior
            </button>
            <button
              type="button"
              onClick={onAddItem}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
            >
              <FaPlus />
              Adicionar pneu
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {form.itens.map((item, index) => (
            <SectionBlock key={`estoque-item-${index}`} title={`Pneu ${index + 1}`}>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <InputField
                  label="Numero de fogo"
                  value={item.numeroFogo}
                  onChange={(value) => onItemChange(index, "numeroFogo", value)}
                  inputMode="numeric"
                  pattern="[0-9]*"
                />
                <SelectField
                  label="Marca"
                  value={item.marca}
                  onChange={(value) => onItemChange(index, "marca", value)}
                  options={MARCAS_PNEU}
                />
                {item.marca === "Outra" ? (
                  <InputField
                    label="Qual marca?"
                    value={item.marcaOutra}
                    onChange={(value) => onItemChange(index, "marcaOutra", value)}
                  />
                ) : (
                  <div />
                )}
                <SelectField
                  label="Situacao"
                  value={item.situacao}
                  onChange={(value) => onItemChange(index, "situacao", value)}
                  options={SITUACOES_ESTOQUE}
                />
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => onRemoveItem(index)}
                    disabled={form.itens.length === 1}
                    className="w-full rounded-lg bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-600 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Remover pneu
                  </button>
                </div>
              </div>
            </SectionBlock>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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

function ConsertoModal({
  open,
  form,
  saving,
  onClose,
  onFieldChange,
  onSalvar,
}) {
  if (!open) return null;

  return (
    <ModalShell
      title="Lancar conserto de pneu"
      subtitle="PCM · Consertos"
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
            {saving ? "Salvando..." : "Enviar para conserto"}
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
            label="Origem"
            value={form.origemTab}
            onChange={(value) => onFieldChange("origemTab", value)}
            options={[TAB_AUDITORIA, TAB_ESTOQUE, TAB_TROCA]}
          />
          <CampoPrefixo
            value={form.prefixo}
            onChange={(value) => onFieldChange("prefixo", value)}
            label="Prefixo"
            inputMode="numeric"
            pattern="[0-9]*"
          />
          <InputField
            label="Numero de fogo"
            value={form.numeroFogo}
            onChange={(value) => onFieldChange("numeroFogo", value)}
            inputMode="numeric"
            pattern="[0-9]*"
          />
          <InputField
            label="Situacao de origem"
            value={form.situacaoOrigem}
            onChange={(value) => onFieldChange("situacaoOrigem", value)}
            placeholder="Ex.: INCORRETO"
          />
        </div>

        <InputField
          label="Observacoes"
          value={form.observacoes}
          onChange={(value) => onFieldChange("observacoes", value)}
          placeholder="Descreva o que o borracheiro precisa ajustar"
        />
      </div>
    </ModalShell>
  );
}

function RiscadoModal({
  open,
  form,
  saving,
  onClose,
  onFieldChange,
  onFotoChange,
  onCapturePhoto,
  onSalvar,
  isNativeShell,
}) {
  if (!open) return null;

  return (
    <ModalShell
      title="Lancar pneu riscado"
      subtitle="PCM · Riscados"
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
            {saving ? "Salvando..." : "Salvar riscado"}
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
            label="Dia do risco"
            value={form.dataRiscado}
            onChange={(value) => onFieldChange("dataRiscado", value)}
            type="date"
          />
          <CampoPrefixo
            value={form.prefixo}
            onChange={(value) => onFieldChange("prefixo", value)}
            label="Carro / Prefixo"
            inputMode="numeric"
            pattern="[0-9]*"
          />
          <InputField
            label="Numero de fogo"
            value={form.numeroFogo}
            onChange={(value) => onFieldChange("numeroFogo", value)}
            inputMode="numeric"
            pattern="[0-9]*"
          />
          <SelectField
            label="Marca"
            value={form.marca}
            onChange={(value) => onFieldChange("marca", value)}
            options={MARCAS_PNEU}
          />
          {form.marca === "Outra" ? (
            <InputField
              label="Qual marca?"
              value={form.marcaOutra}
              onChange={(value) => onFieldChange("marcaOutra", value)}
            />
          ) : null}
          <InputField
            label="MM antes"
            value={form.mmAntes}
            onChange={(value) => onFieldChange("mmAntes", value)}
            inputMode="decimal"
          />
          <InputField
            label="MM depois"
            value={form.mmDepois}
            onChange={(value) => onFieldChange("mmDepois", value)}
            inputMode="decimal"
          />
        </div>

        <PhotoField
          title="Foto do pneu riscado"
          file={form.foto}
          inputId="riscado-foto"
          onChange={(event) => onFotoChange(event.target.files?.[0] || null)}
          onNativeCapture={onCapturePhoto}
          isNativeShell={isNativeShell}
        />

        <InputField
          label="Observacoes"
          value={form.observacoes}
          onChange={(value) => onFieldChange("observacoes", value)}
          placeholder="Descreva o ocorrido"
        />
      </div>
    </ModalShell>
  );
}

function AuditoriaPendenciasModal({
  open,
  rows,
  onClose,
  onLancar,
}) {
  if (!open) return null;

  return (
    <ModalShell
      title="Carros sem auditoria recente"
      subtitle="PCM · Auditoria"
      onClose={onClose}
      maxWidth="max-w-4xl"
      footer={
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-slate-100 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-200"
          >
            Fechar
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          Existem {rows.length} carro(s) sem auditoria há mais de 30 dias ou ainda sem auditoria registrada.
        </div>

        <div className="space-y-3">
          {rows.map((row) => (
            <div key={row.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="grid flex-1 grid-cols-1 gap-3 md:grid-cols-4">
                  <DetailRow label="Prefixo" value={row.prefixo} />
                  <DetailRow label="Cluster" value={row.cluster || "-"} />
                  <DetailRow
                    label="Ultima auditoria"
                    value={row.semAuditoria ? "Sem auditoria" : formatDate(row.ultimaAuditoria)}
                  />
                  <DetailRow
                    label="Dias sem auditoria"
                    value={row.semAuditoria ? "Nunca auditado" : String(row.diasSemAuditoria || 0)}
                  />
                </div>

                <button
                  type="button"
                  onClick={() => onLancar(row.prefixo)}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  <FaClipboardCheck />
                  Lançar auditoria
                </button>
              </div>
            </div>
          ))}
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
  checkingStatusKey,
  isNativeShell,
  onClose,
  onMarcarTransnet,
  onMarcarAuditoriaStatus,
  onMarcarEstoqueStatus,
  onMarcarConsertoStatus,
  onEnviarConserto,
  onAbrirRiscado,
  getConsertoSourceMeta,
}) {
  const [auditoriaEditando, setAuditoriaEditando] = useState({});
  const [estoqueEditando, setEstoqueEditando] = useState({});

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
              <DetailRow label="Numero de fogo" value={row.numero_fogo_retirado} />
              {row.foto_numero_fogo_retirado_url ? (
                <ZoomableImage
                  src={row.foto_numero_fogo_retirado_url}
                  alt="Numero de fogo retirado"
                  isNativeShell={isNativeShell}
                />
              ) : null}
              {row.numero_fogo_retirado ? (
                <button
                  type="button"
                  onClick={() =>
                    onEnviarConserto({
                      origemTab: TAB_TROCA,
                      origemItemId: row.id,
                      prefixo: row.prefixo_retirada || row.prefixo,
                      numeroFogo: row.numero_fogo_retirado,
                      situacaoOrigem: "Pneu retirado",
                      observacoes: `Enviado a partir da troca ${row.ficha_troca || ""} · Pneu retirado.`,
                    })
                  }
                  className="rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-600"
                >
                  <FaWrench className="inline mr-2" />
                  Enviar para conserto
                </button>
              ) : null}
            </div>
          </SectionBlock>

          <SectionBlock title="Pneu colocado">
            <div className="grid grid-cols-1 gap-4">
              <DetailRow label="Prefixo" value={row.prefixo_instalacao || row.prefixo} />
              <DetailRow label="Posicao" value={row.posicao_instalacao || row.posicao} />
              <DetailRow label="Numero de fogo" value={row.numero_fogo_colocado || row.numero_fogo_pneu} />
              {row.foto_numero_fogo_colocado_url || row.foto_numero_fogo_url ? (
                <ZoomableImage
                  src={row.foto_numero_fogo_colocado_url || row.foto_numero_fogo_url}
                  alt="Numero de fogo colocado"
                  isNativeShell={isNativeShell}
                />
              ) : null}
              {(row.numero_fogo_colocado || row.numero_fogo_pneu) ? (
                <button
                  type="button"
                  onClick={() =>
                    onEnviarConserto({
                      origemTab: TAB_TROCA,
                      origemItemId: row.id,
                      prefixo: row.prefixo_instalacao || row.prefixo,
                      numeroFogo: row.numero_fogo_colocado || row.numero_fogo_pneu,
                      situacaoOrigem: "Pneu colocado",
                      observacoes: `Enviado a partir da troca ${row.ficha_troca || ""} · Pneu colocado.`,
                    })
                  }
                  className="rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-600"
                >
                  <FaWrench className="inline mr-2" />
                  Enviar para conserto
                </button>
              ) : null}
            </div>
          </SectionBlock>
        </div>

        {row.origem_recebeu ? (
          <SectionBlock title="O que ficou no carro de origem">
            <div className="grid grid-cols-1 gap-4">
              <DetailRow label="Destino do pneu retirado" value={row.origem_recebeu} />
              {row.numero_fogo_origem_recebido ? (
                <DetailRow label="Numero de fogo recebido" value={row.numero_fogo_origem_recebido} />
              ) : null}
              {row.foto_numero_fogo_origem_recebido_url ? (
                <ZoomableImage
                  src={row.foto_numero_fogo_origem_recebido_url}
                  alt="Numero de fogo recebido no carro de origem"
                  isNativeShell={isNativeShell}
                />
              ) : null}
            </div>
          </SectionBlock>
        ) : null}

        {row.consertoRelacionado ? (
          <DetailRow
            label="Conserto vinculado"
            value={`${row.consertoRelacionado.situacao_origem || row.consertoRelacionado.origem_tab || "Troca"} · ${row.consertoRelacionado.numero_fogo || "-"}`}
          />
        ) : null}

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
          {getAuditoriaPosicoes(row).map((item) => {
            const temConferencia = !!item.conferencia_status;
            const editando = !!auditoriaEditando[item.posicao] || !temConferencia;

            return (
              <SectionBlock key={item.posicao} title={item.posicao}>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <DetailRow label="Numero de fogo" value={item.numero_fogo} />
                  <DetailRow label="Calibragem" value={item.calibragem} />
                  <DetailRow label="Sulco" value={item.sulco} />
                </div>

                {item.foto_url ? (
                  <ZoomableImage
                    src={item.foto_url}
                    alt={item.posicao}
                    isNativeShell={isNativeShell}
                  />
                ) : null}

                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <DetailRow label="Conferencia" value={item.conferencia_status || "Pendente"} />

                  {editando ? (
                    <>
                      <button
                        type="button"
                        onClick={async () => {
                          await onMarcarAuditoriaStatus(item.posicao, "OK");
                          setAuditoriaEditando((current) => ({ ...current, [item.posicao]: false }));
                        }}
                        disabled={checkingStatusKey === `auditoria:${item.posicao}`}
                        className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                      >
                        OK
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await onMarcarAuditoriaStatus(item.posicao, "INCORRETO");
                          setAuditoriaEditando((current) => ({ ...current, [item.posicao]: false }));
                        }}
                        disabled={checkingStatusKey === `auditoria:${item.posicao}`}
                        className="rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
                      >
                        Incorreto
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setAuditoriaEditando((current) => ({ ...current, [item.posicao]: true }))}
                      className="md:col-span-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
                    >
                      Editar conferencia
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <button
                    type="button"
                    onClick={() =>
                      onEnviarConserto({
                        origemTab: TAB_AUDITORIA,
                        origemItemId: `${row.id}:${item.posicao}`,
                        prefixo: row.prefixo,
                        numeroFogo: item.numero_fogo,
                        situacaoOrigem: item.conferencia_status || "PENDENTE",
                        observacoes: `Enviado a partir da auditoria ${row.ficha_auditoria} · ${item.posicao}.`,
                      })
                    }
                    className="rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-600"
                  >
                    <FaWrench className="inline mr-2" />
                    Enviar para conserto
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onAbrirRiscado({
                        prefixo: row.prefixo,
                        numeroFogo: item.numero_fogo,
                        observacoes: `Registrado a partir da auditoria ${row.ficha_auditoria} · ${item.posicao}.`,
                      })
                    }
                    className="rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-700"
                  >
                    <FaExclamationTriangle className="inline mr-2" />
                    Lançar riscado
                  </button>
                </div>

                {item.conferencia_por_nome || item.conferencia_por_login ? (
                  <DetailRow
                    label="Conferido por"
                    value={`${item.conferencia_por_nome || item.conferencia_por_login} em ${formatDate(item.conferencia_em)}`}
                  />
                ) : null}
              </SectionBlock>
            );
          })}
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
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <DetailRow label="Data" value={formatDate(row.created_at)} />
          <DetailRow label="Quem lancou" value={row.criado_por_nome || row.criado_por_login} />
          <DetailRow label="Quantidade de pneus" value={String(row.itens?.length || 0)} />
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Conferencia</div>
            <div className="mt-2">
              <BadgeList items={getEstoqueConferenciaCounts(row)} />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="mb-3 text-sm font-black uppercase tracking-wide text-slate-700">Resumo por situacao</div>
          <BadgeList items={getEstoqueSituacaoCounts(row)} />
        </div>

        <div className="space-y-4">
          {(row.itens || []).map((item, index) => {
            const temConferencia = !!item.transnet_status;
            const editando = !!estoqueEditando[item.id] || !temConferencia;

            return (
              <SectionBlock key={item.id || `${item.numero_pneu}-${index}`} title={`Pneu ${index + 1} · ${item.numero_pneu || "Sem numero"}`}>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <DetailRow label="Numero de fogo" value={item.numero_fogo || item.numero_pneu} />
                  <DetailRow label="Marca" value={item.marca} />
                  <DetailRow label="Situacao" value={item.situacao} />
                </div>
                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                  <DetailRow label="Conferencia" value={item.transnet_status || "Pendente"} />

                  {editando ? (
                    <>
                      <button
                        type="button"
                        onClick={async () => {
                          await onMarcarEstoqueStatus(item.id, "OK");
                          setEstoqueEditando((current) => ({ ...current, [item.id]: false }));
                        }}
                        disabled={checkingStatusKey === `estoque:${item.id}`}
                        className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                      >
                        OK
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await onMarcarEstoqueStatus(item.id, "INCORRETO");
                          setEstoqueEditando((current) => ({ ...current, [item.id]: false }));
                        }}
                        disabled={checkingStatusKey === `estoque:${item.id}`}
                        className="rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
                      >
                        Incorreto
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setEstoqueEditando((current) => ({ ...current, [item.id]: true }))}
                      className="md:col-span-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
                    >
                      Editar conferencia
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <button
                    type="button"
                    onClick={() =>
                      onEnviarConserto({
                        origemTab: TAB_ESTOQUE,
                        origemItemId: item.id,
                        prefixo: "",
                        numeroFogo: item.numero_fogo || item.numero_pneu,
                        situacaoOrigem: item.transnet_status || item.situacao || "PENDENTE",
                        observacoes: `Enviado a partir do estoque ${row.ficha_estoque}.`,
                      })
                    }
                    className="rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-600"
                  >
                    <FaWrench className="inline mr-2" />
                    Enviar para conserto
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onAbrirRiscado({
                        prefixo: "",
                        numeroFogo: item.numero_fogo || item.numero_pneu,
                        marca: item.marca,
                        observacoes: `Registrado a partir do estoque ${row.ficha_estoque}.`,
                      })
                    }
                    className="rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-700"
                  >
                    <FaExclamationTriangle className="inline mr-2" />
                    Lançar riscado
                  </button>
                </div>

                {item.transnet_conferido_por_nome || item.transnet_conferido_por_login ? (
                  <DetailRow
                    label="Conferido por"
                    value={`${item.transnet_conferido_por_nome || item.transnet_conferido_por_login} em ${formatDate(item.transnet_conferido_em)}`}
                  />
                ) : null}
              </SectionBlock>
            );
          })}
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

  if (tab === TAB_CONSERTOS) {
    const sourceMeta = getConsertoSourceMeta?.(row) || null;

    title = row.ficha_conserto || "Conserto de pneu";
    content = (
      <div className="space-y-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <DetailRow label="Data" value={formatDate(row.created_at)} />
          <DetailRow label="Quem lancou" value={row.criado_por_nome || row.criado_por_login} />
          <DetailRow label="Numero de fogo" value={row.numero_fogo || "-"} />
          <DetailRow label="Status" value={row.status || "PENDENTE"} />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <DetailRow label="Prefixo" value={row.prefixo || "-"} />
          <DetailRow label="Origem" value={row.situacao_origem || row.origem_tab || "-"} />
          <DetailRow label="Ficha de origem" value={sourceMeta?.fichaOrigem || "-"} />
        </div>

        {sourceMeta?.origemResumo ? <DetailRow label="Detalhe da origem" value={sourceMeta.origemResumo} /> : null}

        {sourceMeta?.fotoUrl ? (
          <SectionBlock title="Foto vinculada ao conserto">
            <ZoomableImage
              src={sourceMeta.fotoUrl}
              alt={sourceMeta.fotoAlt || "Foto do pneu em conserto"}
              isNativeShell={isNativeShell}
            />
          </SectionBlock>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-500">
            Esse conserto nao possui foto de origem disponivel para exibicao.
          </div>
        )}

        {row.observacoes ? <DetailRow label="Observacoes" value={row.observacoes} /> : null}
      </div>
    );

    footer = (
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-xs text-slate-500">
          Atualize quando o borracheiro receber ou concluir esse conserto.
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
            onClick={() => onMarcarConsertoStatus?.(row.id, "EM CONSERTO")}
            disabled={checkingStatusKey === `conserto:${row.id}:EM CONSERTO` || norm(row.status) === "EM CONSERTO"}
            className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            Receber
          </button>
          <button
            type="button"
            onClick={() => onMarcarConsertoStatus?.(row.id, "CONCLUIDO")}
            disabled={checkingStatusKey === `conserto:${row.id}:CONCLUIDO` || norm(row.status) === "CONCLUIDO"}
            className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            Dar baixa
          </button>
        </div>
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
  const [searchParams, setSearchParams] = useSearchParams();
  const userName = safeText(user?.nome || user?.login || user?.email) || "Equipe PCM";
  const initialTab = isTabValue(searchParams.get("aba")) ? searchParams.get("aba") : TAB_TROCA;

  const [activeTab, setActiveTab] = useState(initialTab);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [transnetSaving, setTransnetSaving] = useState(false);
  const [checkingStatusKey, setCheckingStatusKey] = useState("");
  const [offlineCount, setOfflineCount] = useState(0);
  const [syncingOffline, setSyncingOffline] = useState(false);
  const [isOnline, setIsOnline] = useState(() => window.navigator.onLine);

  const [trocas, setTrocas] = useState([]);
  const [auditorias, setAuditorias] = useState([]);
  const [estoqueRows, setEstoqueRows] = useState([]);
  const [consertos, setConsertos] = useState([]);
  const [riscados, setRiscados] = useState([]);
  const [prefixos, setPrefixos] = useState([]);
  const [alertasAbertos, setAlertasAbertos] = useState([]);
  const [auditoriaPendenciasOpen, setAuditoriaPendenciasOpen] = useState(false);
  const [auditoriaPendenciasAck, setAuditoriaPendenciasAck] = useState("");

  const [trocaForm, setTrocaForm] = useState(() => createTrocaForm("", userName));
  const [auditoriaForm, setAuditoriaForm] = useState(() => createAuditoriaForm("", userName));
  const [estoqueForm, setEstoqueForm] = useState(() => createEstoqueForm("", userName));
  const [consertoForm, setConsertoForm] = useState(() => createConsertoForm("", userName));
  const [riscadoForm, setRiscadoForm] = useState(() => createRiscadoForm("", userName));

  const [trocaOpen, setTrocaOpen] = useState(false);
  const [auditoriaOpen, setAuditoriaOpen] = useState(false);
  const [estoqueOpen, setEstoqueOpen] = useState(false);
  const [consertoOpen, setConsertoOpen] = useState(false);
  const [riscadoOpen, setRiscadoOpen] = useState(false);

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
  const [consertoFiltros, setConsertoFiltros] = useState({
    busca: "",
    status: "",
    dataInicio: "",
    dataFim: "",
  });
  const [riscadoFiltros, setRiscadoFiltros] = useState({
    busca: "",
    status: "",
    dataInicio: "",
    dataFim: "",
  });

  async function refreshOfflineCount() {
    try {
      const rows = await listSubmissions();
      setOfflineCount(rows.length);
      return rows;
    } catch (error) {
      console.error("Erro ao ler fila offline:", error);
      return [];
    }
  }

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

  async function carregarPrefixos() {
    const { data, error } = await supabase
      .from("prefixos")
      .select("id, codigo, cluster")
      .order("codigo", { ascending: true });

    if (error) throw error;
    setPrefixos(data || []);
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

  async function carregarConsertos() {
    const { data, error } = await supabase
      .from("pcm_consertos_pneus")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(300);

    if (error) throw error;
    setConsertos(data || []);
    return data || [];
  }

  async function carregarRiscados() {
    const { data, error } = await supabase
      .from("pcm_riscados_pneus")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(300);

    if (error) throw error;
    setRiscados(data || []);
    return data || [];
  }

  async function aplicar() {
    setLoading(true);
    try {
      await Promise.all([
        carregarTrocas(),
        carregarAuditorias(),
        carregarEstoque(),
        carregarConsertos(),
        carregarRiscados(),
        carregarPrefixos(),
      ]);
    } catch (error) {
      console.error("Erro ao carregar central de pneus:", error);
      alert(error?.message || "Nao foi possivel carregar a central de pneus.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    aplicar();
    refreshOfflineCount().then(() => {
      void syncOfflineQueue();
    });
  }, []);

  useEffect(() => {
    function handleOnline() {
      setIsOnline(true);
      void syncOfflineQueue();
    }

    function handleOffline() {
      setIsOnline(false);
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    const nextTab = searchParams.get("aba");
    if (isTabValue(nextTab) && nextTab !== activeTab) {
      setActiveTab(nextTab);
      return;
    }

    if (!isTabValue(nextTab)) {
      setSearchParams({ aba: activeTab }, { replace: true });
    }
  }, [activeTab, searchParams, setSearchParams]);

  useEffect(() => {
    if (!isNativeShell) return undefined;

    const handlePopState = () => {
      if (consulta.open) {
        closeConsulta();
      } else if (trocaOpen) {
        setTrocaOpen(false);
      } else if (auditoriaOpen) {
        setAuditoriaOpen(false);
      } else if (estoqueOpen) {
        setEstoqueOpen(false);
      } else if (consertoOpen) {
        setConsertoOpen(false);
      } else if (riscadoOpen) {
        setRiscadoOpen(false);
      } else if (activeTab !== TAB_TROCA) {
        handleTabChange(TAB_TROCA);
      }

      window.history.pushState({ inoveMobile: true }, "", `${window.location.pathname}${window.location.search}`);
    };

    window.history.pushState({ inoveMobile: true }, "", `${window.location.pathname}${window.location.search}`);
    window.addEventListener("popstate", handlePopState);

    const backListener = CapacitorApp.addListener("backButton", ({ canGoBack }) => {
      if (consulta.open || trocaOpen || auditoriaOpen || estoqueOpen || consertoOpen || riscadoOpen || activeTab !== TAB_TROCA) {
        handlePopState();
        return;
      }

      if (canGoBack) {
        window.history.back();
        return;
      }

      window.history.pushState({ inoveMobile: true }, "", `${window.location.pathname}${window.location.search}`);
    });

    return () => {
      window.removeEventListener("popstate", handlePopState);
      backListener.then((listener) => listener.remove());
    };
  }, [activeTab, auditoriaOpen, consertoOpen, consulta.open, estoqueOpen, isNativeShell, riscadoOpen, trocaOpen]);

  useEffect(() => {
    setTrocaForm((current) => ({ ...current, dataLancamento: nowDisplay(), quemLancou: userName }));
    setAuditoriaForm((current) => ({ ...current, dataLancamento: nowDisplay(), quemLancou: userName }));
    setEstoqueForm((current) => ({ ...current, dataLancamento: nowDisplay(), quemLancou: userName }));
    setConsertoForm((current) => ({ ...current, dataLancamento: nowDisplay(), quemLancou: userName }));
    setRiscadoForm((current) => ({ ...current, dataLancamento: nowDisplay(), quemLancou: userName }));
  }, [userName]);

  const estoqueAgrupado = useMemo(() => groupEstoqueRows(estoqueRows), [estoqueRows]);

  const cardsTroca = useMemo(() => {
    const lancadasTransnet = trocas.filter((item) => !!item.transnet_lancado_em).length;

    return {
      total: trocas.length,
      transnetLancadas: lancadasTransnet,
      transnetPendentes: trocas.length - lancadasTransnet,
      estoqueCarro: trocas.filter((item) => norm(item.tipo_troca) === TIPO_TROCA_ESTOQUE).length,
      carroCarro: trocas.filter((item) => norm(item.tipo_troca) === TIPO_TROCA_CARRO).length,
    };
  }, [trocas]);

  const cardsAuditoria = useMemo(() => {
    const concluidas = auditorias.filter((item) => isAuditoriaConcluida(item)).length;

    return {
      total: auditorias.length,
      pendentes: auditorias.length - concluidas,
      concluidas,
      incorretas: auditorias.filter((item) => hasAuditoriaIncorreta(item)).length,
    };
  }, [auditorias]);

  const cardsEstoque = useMemo(() => {
    const ultimaFicha = estoqueAgrupado[0] || null;
    const itens = ultimaFicha?.itens || [];

    return {
      ficha: ultimaFicha?.ficha_estoque || "-",
      data: ultimaFicha?.created_at ? formatDate(ultimaFicha.created_at) : "-",
      total: itens.length,
      ok: itens.filter((item) => norm(item.transnet_status) === "OK").length,
      incorretos: itens.filter((item) => norm(item.transnet_status) === "INCORRETO").length,
      pendentes: itens.filter((item) => !norm(item.transnet_status)).length,
      novo: itens.filter((item) => norm(item.situacao) === "NOVO").length,
      uso: itens.filter((item) => norm(item.situacao) === "USADO ( PARA USO )").length,
      recapagem: itens.filter((item) => norm(item.situacao) === "ENVIAR PARA RECAPAGEM").length,
      recapado: itens.filter((item) => norm(item.situacao) === "RECAPADO").length,
      sucata: itens.filter((item) => norm(item.situacao) === "SUCATA").length,
    };
  }, [estoqueAgrupado]);

  const cardsConsertos = useMemo(
    () => ({
      total: consertos.length,
      pendentes: consertos.filter((item) => norm(item.status) === "PENDENTE").length,
      emConserto: consertos.filter((item) => norm(item.status) === "EM CONSERTO").length,
      concluidos: consertos.filter((item) => norm(item.status) === "CONCLUIDO").length,
    }),
    [consertos]
  );

  const cardsRiscados = useMemo(
    () => ({
      total: riscados.length,
      abertos: riscados.filter((item) => norm(item.status) === "ABERTO").length,
      acompanhando: riscados.filter((item) => norm(item.status) === "ACOMPANHANDO").length,
      vencidos10Dias: riscados.filter((item) => diffDaysFromToday(item.data_riscado) >= 10).length,
    }),
    [riscados]
  );

  const auditoriasAtrasadas = useMemo(
    () => buildAuditoriaAtrasadaList(prefixos, auditorias),
    [auditorias, prefixos]
  );

  const { setBadges: setMobileBadges } = useMobileTabBadges();
  useEffect(() => {
    setMobileBadges({
      troca: 0,
      auditoria: auditoriasAtrasadas.length,
      estoque: 0,
      consertos: cardsConsertos.pendentes,
      riscados: cardsRiscados.vencidos10Dias,
    });
    return () => setMobileBadges({});
  }, [auditoriasAtrasadas.length, cardsConsertos.pendentes, cardsRiscados.vencidos10Dias, setMobileBadges]);

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
    }).map((row) => ({
      ...row,
      consertoRelacionado:
        consertos.find((item) => item.origem_tab === TAB_TROCA && String(item.origem_item_id || "") === String(row.id)) || null,
    }));
  }, [consertos, trocas, trocaFiltros]);

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
    return estoqueAgrupado.filter((row) => {
      if (!inDateRange(row.created_at, estoqueFiltros.dataInicio, estoqueFiltros.dataFim)) return false;
      if (estoqueFiltros.situacao && !row.itens.some((item) => item.situacao === estoqueFiltros.situacao)) {
        return false;
      }
      if (!busca) return true;

      const alvo = [
        row.ficha_estoque,
        row.criado_por_nome,
        row.criado_por_login,
        ...row.itens.flatMap((item) => [item.numero_fogo, item.numero_pneu, item.marca, item.situacao]),
      ]
        .map((item) => norm(item).toLowerCase())
        .join(" ");

      return alvo.includes(busca);
    });
  }, [estoqueAgrupado, estoqueFiltros]);

  const consertosFiltrados = useMemo(() => {
    const busca = norm(consertoFiltros.busca).toLowerCase();
    return consertos.filter((row) => {
      if (!inDateRange(row.created_at, consertoFiltros.dataInicio, consertoFiltros.dataFim)) return false;
      if (consertoFiltros.status && row.status !== consertoFiltros.status) return false;
      if (!busca) return true;

      const alvo = [
        row.ficha_conserto,
        row.numero_fogo,
        row.prefixo,
        row.situacao_origem,
        row.status,
        row.criado_por_nome,
        row.criado_por_login,
      ]
        .map((item) => norm(item).toLowerCase())
        .join(" ");

      return alvo.includes(busca);
    });
  }, [consertoFiltros, consertos]);

  const riscadosFiltrados = useMemo(() => {
    const busca = norm(riscadoFiltros.busca).toLowerCase();
    return riscados.filter((row) => {
      if (!inDateRange(row.created_at, riscadoFiltros.dataInicio, riscadoFiltros.dataFim)) return false;
      if (riscadoFiltros.status && row.status !== riscadoFiltros.status) return false;
      if (!busca) return true;

      const alvo = [
        row.ficha_riscado,
        row.numero_fogo,
        row.prefixo,
        row.status,
        row.criado_por_nome,
        row.criado_por_login,
      ]
        .map((item) => norm(item).toLowerCase())
        .join(" ");

      return alvo.includes(busca);
    });
  }, [riscadoFiltros, riscados]);

  function getConsertoSourceMeta(row) {
    return resolveConsertoSourceMeta(row, trocas, auditorias);
  }

  useEffect(() => {
    async function processarAlertas() {
      const nextAlertas = [];

      const riscadosVencidos = riscados.filter((item) => {
        if (norm(item.status) === "RESOLVIDO") return false;
        const cicloAtual = buildAlertCycle(diffDaysFromToday(item.data_riscado));
        return cicloAtual > Number(item.ultimo_alerta_ciclo || 0);
      });

      if (riscadosVencidos.length) {
        nextAlertas.push(
          ...riscadosVencidos.map((item) => ({
            id: `riscado-${item.id}`,
            type: "riscado",
            title: "Pneu riscado sem retorno",
            message: `${item.numero_fogo || "-"} do prefixo ${item.prefixo || "-"} passou ${diffDaysFromToday(item.data_riscado)} dia(s) desde o risco.`,
          }))
        );

        for (const item of riscadosVencidos) {
          const cicloAtual = buildAlertCycle(diffDaysFromToday(item.data_riscado));
          await supabase
            .from("pcm_riscados_pneus")
            .update({ ultimo_alerta_ciclo: cicloAtual })
            .eq("id", item.id);

          await notifyDevice({
            title: "Alerta de pneu riscado",
            body: `${item.numero_fogo || "-"} do prefixo ${item.prefixo || "-"} está aberto há ${diffDaysFromToday(item.data_riscado)} dia(s).`,
            seed: `riscado-${item.id}-${cicloAtual}`,
          });
        }

        if (riscadosVencidos.length) {
          await carregarRiscados();
        }
      }

      const consertosPendentes = consertos.filter(
        (item) => item.notificacao_pendente && norm(item.status) !== "CONCLUIDO"
      );

      if (consertosPendentes.length) {
        nextAlertas.push(
          ...consertosPendentes.map((item) => ({
            id: `conserto-${item.id}`,
            type: "conserto",
            title: "Pneu aguardando conserto",
            message: `${item.numero_fogo || "-"} ${item.prefixo ? `· prefixo ${item.prefixo}` : ""} foi enviado para o borracheiro.`,
          }))
        );

        for (const item of consertosPendentes) {
          await notifyDevice({
            title: "Novo pneu para conserto",
            body: `${item.numero_fogo || "-"} ${item.prefixo ? `do prefixo ${item.prefixo}` : ""} foi enviado para conserto.`,
            seed: `conserto-${item.id}`,
          });
        }

        await supabase
          .from("pcm_consertos_pneus")
          .update({
            notificacao_pendente: false,
            notificacao_enviada_em: new Date().toISOString(),
          })
          .in(
            "id",
            consertosPendentes.map((item) => item.id)
          );

        if (consertosPendentes.length) {
          await carregarConsertos();
        }
      }

      if (nextAlertas.length) {
        setAlertasAbertos(nextAlertas);
      }
    }

    if (riscados.length || consertos.length) {
      void processarAlertas();
    }
  }, [consertos, riscados]);

  useEffect(() => {
    if (!auditoriasAtrasadas.length) {
      setAuditoriaPendenciasOpen(false);
      setAuditoriaPendenciasAck("");
      return;
    }

    const assinatura = auditoriasAtrasadas
      .map((item) => `${item.prefixo}:${item.ultimaAuditoria || "sem-auditoria"}`)
      .join("|");

    if (assinatura !== auditoriaPendenciasAck) {
      setAuditoriaPendenciasOpen(true);
      setAuditoriaPendenciasAck(assinatura);
    }
  }, [auditoriaPendenciasAck, auditoriasAtrasadas]);

  function openConsulta(tab, row) {
    setConsulta({ open: true, tab, row });
  }

  function closeConsulta() {
    setConsulta({ open: false, tab: activeTab, row: null });
  }

  function handleTabChange(tab) {
    setActiveTab(tab);
    setSearchParams({ aba: tab });
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

    if (activeTab === TAB_CONSERTOS) {
      setConsertoFiltros({
        busca: "",
        status: "",
        dataInicio: "",
        dataFim: "",
      });
      return;
    }

    if (activeTab === TAB_RISCADOS) {
      setRiscadoFiltros({
        busca: "",
        status: "",
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

    if (activeTab === TAB_ESTOQUE) {
      const rowsRef = estoqueRows.length ? estoqueRows : await carregarEstoque();
      setEstoqueForm(createEstoqueForm(buildNextFicha(rowsRef, "ficha_estoque", "EP"), userName));
      setEstoqueOpen(true);
      return;
    }

    if (activeTab === TAB_CONSERTOS) {
      const rowsRef = consertos.length ? consertos : await carregarConsertos();
      setConsertoForm(createConsertoForm(buildNextFicha(rowsRef, "ficha_conserto", "CP"), userName));
      setConsertoOpen(true);
      return;
    }

    const rowsRef = riscados.length ? riscados : await carregarRiscados();
    setRiscadoForm(createRiscadoForm(buildNextFicha(rowsRef, "ficha_riscado", "RP"), userName));
    setRiscadoOpen(true);
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

  async function captureTrocaPhoto(field, fileNamePrefix) {
    try {
      const file = await captureNativePhoto(fileNamePrefix);
      if (file) updateTrocaFoto(field, file);
    } catch (error) {
      console.error("Erro ao capturar foto da troca:", error);
      alert("Nao foi possivel abrir a camera agora.");
    }
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

  async function captureAuditoriaPhoto(index) {
    try {
      const file = await captureNativePhoto(`auditoria_${index + 1}`);
      if (file) updateAuditoriaPosicao(index, "foto", file);
    } catch (error) {
      console.error("Erro ao capturar foto da auditoria:", error);
      alert("Nao foi possivel abrir a camera agora.");
    }
  }

  function updateEstoqueField(field, value) {
    setEstoqueForm((current) => ({ ...current, [field]: value }));
  }

  function updateEstoqueItem(index, field, value) {
    setEstoqueForm((current) => ({
      ...current,
      itens: current.itens.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              [field]: value,
              ...(field === "marca" && value !== "Outra" ? { marcaOutra: "" } : {}),
            }
          : item
      ),
    }));
  }

  function updateConsertoField(field, value) {
    setConsertoForm((current) => ({ ...current, [field]: value }));
  }

  function updateRiscadoField(field, value) {
    setRiscadoForm((current) => ({ ...current, [field]: value }));
  }

  async function captureRiscadoPhoto() {
    try {
      const file = await captureNativePhoto("riscado");
      if (file) {
        setRiscadoForm((current) => ({ ...current, foto: file }));
      }
    } catch (error) {
      console.error("Erro ao capturar foto do riscado:", error);
      alert("Nao foi possivel abrir a camera agora.");
    }
  }

  function addEstoqueItem() {
    setEstoqueForm((current) => ({
      ...current,
      itens: [...current.itens, createEstoqueItem()],
    }));
  }

  function removeEstoqueItem(index) {
    setEstoqueForm((current) => ({
      ...current,
      itens:
        current.itens.length === 1
          ? current.itens
          : current.itens.filter((_, itemIndex) => itemIndex !== index),
    }));
  }

  function copiarEstoqueAnterior() {
    const ultimaFicha = estoqueAgrupado[0];

    if (!ultimaFicha?.itens?.length) {
      alert("Nao encontrei estoque anterior para copiar.");
      return;
    }

    const itensCopiados = ultimaFicha.itens.map((item) => ({
      numeroPneu: norm(item.numero_pneu),
      numeroFogo: norm(item.numero_fogo || item.numero_pneu),
      marca: MARCAS_PNEU.includes(norm(item.marca)) ? norm(item.marca) : "Outra",
      marcaOutra: MARCAS_PNEU.includes(norm(item.marca)) ? "" : norm(item.marca),
      situacao: SITUACOES_ESTOQUE.includes(norm(item.situacao)) ? norm(item.situacao) : SITUACOES_ESTOQUE[0],
    }));

    setEstoqueForm((current) => ({
      ...current,
      itens: itensCopiados.length ? itensCopiados : [createEstoqueItem()],
      observacoes: current.observacoes || `Copiado da ficha ${ultimaFicha.ficha_estoque || "anterior"}`,
    }));
  }

  async function lancarAuditoriaParaPrefixo(prefixo) {
    const prefixoNormalizado = safeText(prefixo);
    if (!prefixoNormalizado) return;

    const rowsRef = auditorias.length ? auditorias : await carregarAuditorias();
    setAuditoriaForm({
      ...createAuditoriaForm(buildNextFicha(rowsRef, "ficha_auditoria", "AP"), userName),
      prefixo: prefixoNormalizado,
    });
    setActiveTab(TAB_AUDITORIA);
    setSearchParams({ aba: TAB_AUDITORIA });
    setAuditoriaPendenciasOpen(false);
    setAuditoriaOpen(true);
  }

  async function submitTrocaPayload(payload) {
    const trocaId = payload.id || createClientUuid();
    const fotoRetirada = await uploadFoto(
      BUCKET_TROCA,
      "trocas",
      trocaId,
      "numero_retirado",
      payload.fotoRetiradoFile
    );
    const fotoColocada = await uploadFoto(
      BUCKET_TROCA,
      "trocas",
      trocaId,
      "numero_colocado",
      payload.fotoColocadoFile
    );
    const fotoOrigemRecebido = payload.fotoOrigemRecebidoFile
      ? await uploadFoto(BUCKET_TROCA, "trocas", trocaId, "numero_origem_recebido", payload.fotoOrigemRecebidoFile)
      : { path: null, url: null };

    const insertPayload = {
      id: trocaId,
      ficha_troca: payload.ficha,
      prefixo: payload.prefixoInstalacao,
      posicao: payload.posicaoInstalacao,
      tipo_troca: payload.tipoTroca,
      prefixo_retirada: payload.prefixoRetirada,
      posicao_retirada: payload.posicaoRetirada,
      numero_fogo_retirado: payload.numeroFogoRetirado,
      foto_numero_fogo_retirado_path: fotoRetirada.path,
      foto_numero_fogo_retirado_url: fotoRetirada.url,
      prefixo_instalacao: payload.prefixoInstalacao,
      posicao_instalacao: payload.posicaoInstalacao,
      numero_fogo_colocado: payload.numeroFogoColocado,
      foto_numero_fogo_colocado_path: fotoColocada.path,
      foto_numero_fogo_colocado_url: fotoColocada.url,
      numero_fogo_pneu: payload.numeroFogoColocado,
      foto_numero_fogo_path: fotoColocada.path,
      foto_numero_fogo_url: fotoColocada.url,
      origem_recebeu: payload.origemRecebeu || null,
      numero_fogo_origem_recebido: payload.numeroFogoOrigemRecebido || null,
      foto_numero_fogo_origem_recebido_path: fotoOrigemRecebido.path,
      foto_numero_fogo_origem_recebido_url: fotoOrigemRecebido.url,
      observacoes: payload.observacoes,
      criado_por_login: payload.criadoPorLogin,
      criado_por_nome: payload.criadoPorNome,
      criado_por_id: payload.criadoPorId,
      origem: "INOVE_WEB_APP",
    };

    const { error } = await supabase.from("pcm_troca_pneus").upsert([insertPayload], { onConflict: "id" });
    if (error) throw error;

    const consertoPayload = resolveTrocaConsertoPayload({ ...payload, id: trocaId });
    if (consertoPayload) {
      await submitConsertoPayload(consertoPayload);
    }
  }

  async function submitAuditoriaPayload(payload) {
    const auditoriaId = payload.id || createClientUuid();
    const posicoes = [];

    for (let index = 0; index < payload.posicoes.length; index += 1) {
      const item = payload.posicoes[index];
      const uploaded = await uploadFoto(
        BUCKET_AUDITORIA,
        "auditorias",
        auditoriaId,
        `posicao_${index + 1}`,
        item.fotoFile
      );

      posicoes.push({
        posicao: item.posicao,
        numero_fogo: item.numeroFogo,
        calibragem: item.calibragem,
        sulco: item.sulco,
        foto_path: uploaded.path,
        foto_url: uploaded.url,
      });
    }

    const { error } = await supabase.from("pcm_auditoria_pneus").insert([
      {
        id: auditoriaId,
        ficha_auditoria: payload.ficha,
        prefixo: payload.prefixo,
        posicoes,
        observacoes: payload.observacoes,
        criado_por_login: payload.criadoPorLogin,
        criado_por_nome: payload.criadoPorNome,
        criado_por_id: payload.criadoPorId,
        origem: "INOVE_WEB_APP",
      },
    ]);

    if (error) throw error;
  }

  async function submitEstoquePayload(payload) {
    const rows = payload.itens.map((item) => ({
      id: createClientUuid(),
      ficha_estoque: payload.ficha,
      numero_pneu: item.numero_pneu,
      numero_fogo: item.numero_fogo || item.numero_pneu,
      marca: item.marca,
      situacao: item.situacao,
      observacoes: payload.observacoes,
      criado_por_login: payload.criadoPorLogin,
      criado_por_nome: payload.criadoPorNome,
      criado_por_id: payload.criadoPorId,
      origem: "INOVE_WEB_APP",
    }));

    const { error } = await supabase.from("pcm_estoque_pneus").insert(rows);
    if (error) throw error;
  }

  async function submitConsertoPayload(payload) {
    const { error } = await supabase.from("pcm_consertos_pneus").upsert([
      {
        id: payload.id || createClientUuid(),
        ficha_conserto: payload.ficha,
        origem_tab: payload.origemTab,
        origem_item_id: payload.origemItemId,
        prefixo: payload.prefixo,
        numero_fogo: payload.numeroFogo,
        situacao_origem: payload.situacaoOrigem,
        status: "PENDENTE",
        observacoes: payload.observacoes,
        criado_por_login: payload.criadoPorLogin,
        criado_por_nome: payload.criadoPorNome,
        criado_por_id: payload.criadoPorId,
        notificacao_pendente: true,
        origem: "INOVE_WEB_APP",
      },
    ], { onConflict: "id" });
    if (error) throw error;
  }

  async function submitRiscadoPayload(payload) {
    const riscadoId = payload.id || createClientUuid();
    let fotoPath = "";
    let fotoUrl = "";

    if (payload.fotoFile) {
      const uploaded = await uploadFoto(BUCKET_RISCADOS, "riscados", riscadoId, "foto", payload.fotoFile);
      fotoPath = uploaded.path;
      fotoUrl = uploaded.url;
    }

    const { error } = await supabase.from("pcm_riscados_pneus").insert([
      {
        id: riscadoId,
        ficha_riscado: payload.ficha,
        data_riscado: payload.dataRiscado,
        prefixo: payload.prefixo,
        numero_fogo: payload.numeroFogo,
        marca: payload.marca,
        status: "ABERTO",
        mm_antes: payload.mmAntes ? Number(payload.mmAntes) : null,
        mm_depois: payload.mmDepois ? Number(payload.mmDepois) : null,
        foto_path: fotoPath || null,
        foto_url: fotoUrl || null,
        observacoes: payload.observacoes,
        criado_por_login: payload.criadoPorLogin,
        criado_por_nome: payload.criadoPorNome,
        criado_por_id: payload.criadoPorId,
        origem: "INOVE_WEB_APP",
      },
    ]);
    if (error) throw error;
  }

  async function queueTrocaSubmission(payload) {
    await enqueueSubmission({
      id: createClientUuid(),
      type: TAB_TROCA,
      createdAt: new Date().toISOString(),
      payload: {
        ...payload,
        fotoRetiradoFile: await serializeFile(payload.fotoRetiradoFile),
        fotoColocadoFile: await serializeFile(payload.fotoColocadoFile),
        fotoOrigemRecebidoFile: await serializeFile(payload.fotoOrigemRecebidoFile),
      },
    });
    await refreshOfflineCount();
  }

  async function queueAuditoriaSubmission(payload) {
    await enqueueSubmission({
      id: createClientUuid(),
      type: TAB_AUDITORIA,
      createdAt: new Date().toISOString(),
      payload: {
        ...payload,
        posicoes: await Promise.all(
          payload.posicoes.map(async (item) => ({
            ...item,
            fotoFile: await serializeFile(item.fotoFile),
          }))
        ),
      },
    });
    await refreshOfflineCount();
  }

  async function queueEstoqueSubmission(payload) {
    await enqueueSubmission({
      id: createClientUuid(),
      type: TAB_ESTOQUE,
      createdAt: new Date().toISOString(),
      payload,
    });
    await refreshOfflineCount();
  }

  async function syncOfflineQueue() {
    if (!window.navigator.onLine) return;

    const pendentes = await listSubmissions();
    if (!pendentes.length) {
      setOfflineCount(0);
      return;
    }

    setSyncingOffline(true);

    try {
      for (const item of pendentes) {
        if (item.type === TAB_TROCA) {
          await submitTrocaPayload({
            ...item.payload,
            fotoRetiradoFile: base64ToFile(item.payload.fotoRetiradoFile),
            fotoColocadoFile: base64ToFile(item.payload.fotoColocadoFile),
            fotoOrigemRecebidoFile: base64ToFile(item.payload.fotoOrigemRecebidoFile),
          });
        }

        if (item.type === TAB_AUDITORIA) {
          await submitAuditoriaPayload({
            ...item.payload,
            posicoes: item.payload.posicoes.map((posicao) => ({
              ...posicao,
              fotoFile: base64ToFile(posicao.fotoFile),
            })),
          });
        }

        if (item.type === TAB_ESTOQUE) {
          await submitEstoquePayload(item.payload);
        }

        await removeSubmission(item.id);
      }

      await Promise.all([carregarTrocas(), carregarAuditorias(), carregarEstoque(), carregarConsertos()]);
      await refreshOfflineCount();
    } catch (error) {
      console.error("Erro ao sincronizar fila offline:", error);
    } finally {
      setSyncingOffline(false);
    }
  }

  async function salvarTroca(mode = "online") {
    const ficha = safeText(trocaForm.ficha);
    const tipoTroca = safeText(trocaForm.tipoTroca);
    const prefixoInstalacao = safeText(trocaForm.prefixoInstalacao);
    const posicaoInstalacao = safeText(trocaForm.posicaoInstalacao);
    const numeroFogoRetirado = safeText(trocaForm.numeroFogoRetirado);
    const numeroFogoColocado = safeText(trocaForm.numeroFogoColocado);
    const pneuConserto = safeText(trocaForm.pneuConserto) || TROCA_CONSERTO_NENHUM;
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
      alert("As duas fotos do numero de fogo sao obrigatorias.");
      return;
    }

    const origemRecebeu = isEstoqueCarro
      ? ""
      : (safeText(trocaForm.origemRecebeu) || ORIGEM_RECEBEU_SEM_PNEU);
    const numeroFogoOrigemRecebido = safeText(trocaForm.numeroFogoOrigemRecebido);

    if (!isEstoqueCarro && origemRecebeu === ORIGEM_RECEBEU_OUTRO) {
      if (!numeroFogoOrigemRecebido || !trocaForm.fotoOrigemRecebido) {
        alert("Informe o numero de fogo e a foto do pneu que entrou no carro de origem.");
        return;
      }
    }

    const payload = {
      id: createClientUuid(),
      ficha,
      tipoTroca,
      prefixoRetirada,
      posicaoRetirada,
      numeroFogoRetirado,
      fotoRetiradoFile: trocaForm.fotoRetirado,
      prefixoInstalacao,
      posicaoInstalacao,
      numeroFogoColocado,
      fotoColocadoFile: trocaForm.fotoColocado,
      pneuConserto,
      consertoId: pneuConserto !== TROCA_CONSERTO_NENHUM ? createClientUuid() : null,
      consertoFicha: pneuConserto !== TROCA_CONSERTO_NENHUM ? `CP-${ficha}` : null,
      origemRecebeu,
      numeroFogoOrigemRecebido: origemRecebeu === ORIGEM_RECEBEU_OUTRO ? numeroFogoOrigemRecebido : "",
      fotoOrigemRecebidoFile: origemRecebeu === ORIGEM_RECEBEU_OUTRO ? trocaForm.fotoOrigemRecebido : null,
      observacoes,
      criadoPorLogin: safeText(user?.login || user?.email),
      criadoPorNome: safeText(user?.nome),
      criadoPorId: safeText(user?.auth_user_id || user?.id),
    };

    try {
      setSaving(true);

      if (mode === "offline" || !window.navigator.onLine) {
        await queueTrocaSubmission(payload);
      } else {
        await submitTrocaPayload(payload);
      }

      setTrocaOpen(false);
      if (mode === "offline" || !window.navigator.onLine) {
        setTrocaForm(createTrocaForm(trocaForm.ficha, userName));
        alert("Ficha salva offline. Ela sera enviada quando a internet voltar.");
      } else {
        const data = await carregarTrocas();
        if (pneuConserto !== TROCA_CONSERTO_NENHUM) {
          await carregarConsertos();
        }
        setTrocaForm(createTrocaForm(buildNextFicha(data, "ficha_troca", "TP"), userName));
        alert("Ficha de troca salva com sucesso.");
      }
    } catch (error) {
      console.error("Erro ao salvar troca de pneus:", error);
      if (mode !== "offline" && isNetworkError(error)) {
        await queueTrocaSubmission(payload);
        setTrocaOpen(false);
        setTrocaForm(createTrocaForm(trocaForm.ficha, userName));
        alert("Sem internet no envio. A ficha foi guardada offline e sera enviada depois.");
        return;
      }
      alert(error?.message || "Nao foi possivel salvar a troca.");
    } finally {
      setSaving(false);
    }
  }

  async function salvarAuditoria(mode = "online") {
    const ficha = safeText(auditoriaForm.ficha);
    const prefixo = safeText(auditoriaForm.prefixo);
    const observacoes = safeText(auditoriaForm.observacoes);

    if (!ficha || !prefixo) {
      alert("Preencha ficha e prefixo da auditoria.");
      return;
    }

    const hasInvalidPosition = auditoriaForm.posicoes.some(
      (item) => !safeText(item.numeroFogo) || !safeText(item.calibragem) || !safeText(item.sulco) || !item.foto
    );

    if (hasInvalidPosition) {
      alert("Preencha numero de fogo, calibragem, sulco e foto de todas as posicoes.");
      return;
    }

    const payload = {
      id: createClientUuid(),
      ficha,
      prefixo,
      observacoes,
      criadoPorLogin: safeText(user?.login || user?.email),
      criadoPorNome: safeText(user?.nome),
      criadoPorId: safeText(user?.auth_user_id || user?.id),
      posicoes: auditoriaForm.posicoes.map((item) => ({
        posicao: item.posicao,
        numeroFogo: safeText(item.numeroFogo),
        calibragem: safeText(item.calibragem),
        sulco: safeText(item.sulco),
        fotoFile: item.foto,
      })),
    };

    try {
      setSaving(true);

      if (mode === "offline" || !window.navigator.onLine) {
        await queueAuditoriaSubmission(payload);
      } else {
        await submitAuditoriaPayload(payload);
      }

      setAuditoriaOpen(false);
      if (mode === "offline" || !window.navigator.onLine) {
        setAuditoriaForm(createAuditoriaForm(auditoriaForm.ficha, userName));
        alert("Auditoria salva offline. Ela sera enviada quando a internet voltar.");
      } else {
        const data = await carregarAuditorias();
        setAuditoriaForm(createAuditoriaForm(buildNextFicha(data, "ficha_auditoria", "AP"), userName));
        alert("Auditoria salva com sucesso.");
      }
    } catch (error) {
      console.error("Erro ao salvar auditoria:", error);
      if (mode !== "offline" && isNetworkError(error)) {
        await queueAuditoriaSubmission(payload);
        setAuditoriaOpen(false);
        setAuditoriaForm(createAuditoriaForm(auditoriaForm.ficha, userName));
        alert("Sem internet no envio. A auditoria foi guardada offline e sera enviada depois.");
        return;
      }
      alert(error?.message || "Nao foi possivel salvar a auditoria.");
    } finally {
      setSaving(false);
    }
  }

  async function salvarEstoque(mode = "online") {
    const ficha = safeText(estoqueForm.ficha);
    const observacoes = safeText(estoqueForm.observacoes);

    if (!ficha) {
      alert("Numero da ficha e obrigatorio.");
      return;
    }

    const itens = estoqueForm.itens.map((item) => ({
      numero_pneu: safeText(item.numeroPneu) || safeText(item.numeroFogo),
      numero_fogo: safeText(item.numeroFogo) || safeText(item.numeroPneu),
      marca: item.marca === "Outra" ? safeText(item.marcaOutra) : safeText(item.marca),
      situacao: safeText(item.situacao),
    }));

    if (itens.some((item) => !item.numero_fogo || !item.marca || !item.situacao)) {
      alert("Preencha numero de fogo, marca e situacao de todos os pneus do estoque.");
      return;
    }

    const payload = {
      ficha,
      observacoes,
      criadoPorLogin: safeText(user?.login || user?.email),
      criadoPorNome: safeText(user?.nome),
      criadoPorId: safeText(user?.auth_user_id || user?.id),
      itens,
    };

    try {
      setSaving(true);

      if (mode === "offline" || !window.navigator.onLine) {
        await queueEstoqueSubmission(payload);
      } else {
        await submitEstoquePayload(payload);
      }

      setEstoqueOpen(false);
      if (mode === "offline" || !window.navigator.onLine) {
        setEstoqueForm(createEstoqueForm(estoqueForm.ficha, userName));
        alert("Estoque salvo offline. Ele sera enviado quando a internet voltar.");
      } else {
        const data = await carregarEstoque();
        setEstoqueForm(createEstoqueForm(buildNextFicha(data, "ficha_estoque", "EP"), userName));
        alert("Estoque salvo com sucesso.");
      }
    } catch (error) {
      console.error("Erro ao salvar estoque:", error);
      if (mode !== "offline" && isNetworkError(error)) {
        await queueEstoqueSubmission(payload);
        setEstoqueOpen(false);
        setEstoqueForm(createEstoqueForm(estoqueForm.ficha, userName));
        alert("Sem internet no envio. O estoque foi guardado offline e sera enviado depois.");
        return;
      }
      alert(error?.message || "Nao foi possivel salvar o estoque.");
    } finally {
      setSaving(false);
    }
  }

  function abrirConsertoPreenchido(seed = {}) {
    setConsulta({ open: false, tab: activeTab, row: null });
    setTrocaOpen(false);
    setAuditoriaOpen(false);
    setEstoqueOpen(false);
    setRiscadoOpen(false);
    const nextFicha = buildNextFicha(consertos, "ficha_conserto", "CP");
    setConsertoForm({
      ...createConsertoForm(nextFicha, userName),
      origemTab: seed.origemTab || TAB_AUDITORIA,
      origemItemId: seed.origemItemId || "",
      prefixo: seed.prefixo || "",
      numeroFogo: seed.numeroFogo || "",
      situacaoOrigem: seed.situacaoOrigem || "",
      observacoes: seed.observacoes || "",
    });
    setConsertoOpen(true);
  }

  function abrirRiscadoPreenchido(seed = {}) {
    setConsulta({ open: false, tab: activeTab, row: null });
    setTrocaOpen(false);
    setAuditoriaOpen(false);
    setEstoqueOpen(false);
    setConsertoOpen(false);
    const nextFicha = buildNextFicha(riscados, "ficha_riscado", "RP");
    setRiscadoForm({
      ...createRiscadoForm(nextFicha, userName),
      prefixo: seed.prefixo || "",
      numeroFogo: seed.numeroFogo || "",
      marca: seed.marca || MARCAS_PNEU[0],
      observacoes: seed.observacoes || "",
    });
    setRiscadoOpen(true);
  }

  async function salvarConserto() {
    const ficha = safeText(consertoForm.ficha);
    const numeroFogo = safeText(consertoForm.numeroFogo);

    if (!ficha || !numeroFogo) {
      alert("Preencha a ficha e o numero de fogo do conserto.");
      return;
    }

    const payload = {
      ficha,
      origemTab: safeText(consertoForm.origemTab),
      origemItemId: safeText(consertoForm.origemItemId),
      prefixo: safeText(consertoForm.prefixo),
      numeroFogo,
      situacaoOrigem: safeText(consertoForm.situacaoOrigem),
      observacoes: safeText(consertoForm.observacoes),
      criadoPorLogin: safeText(user?.login || user?.email),
      criadoPorNome: safeText(user?.nome),
      criadoPorId: safeText(user?.auth_user_id || user?.id),
    };

    try {
      setSaving(true);
      await submitConsertoPayload(payload);
      setConsertoOpen(false);
      const data = await carregarConsertos();
      setConsertoForm(createConsertoForm(buildNextFicha(data, "ficha_conserto", "CP"), userName));
      await notifyDevice({
        title: "Pneu enviado para conserto",
        body: `${numeroFogo} foi enviado para o borracheiro.`,
        seed: `novo-conserto-${ficha}`,
      });
      alert("Pneu enviado para conserto com sucesso.");
    } catch (error) {
      console.error("Erro ao salvar conserto:", error);
      alert(error?.message || "Nao foi possivel salvar o conserto.");
    } finally {
      setSaving(false);
    }
  }

  async function salvarRiscado() {
    const ficha = safeText(riscadoForm.ficha);
    const prefixo = safeText(riscadoForm.prefixo);
    const numeroFogo = safeText(riscadoForm.numeroFogo);

    if (!ficha || !prefixo || !numeroFogo || !riscadoForm.foto) {
      alert("Preencha ficha, prefixo, numero de fogo e foto do pneu riscado.");
      return;
    }

    const payload = {
      ficha,
      dataRiscado: riscadoForm.dataRiscado || todayValue(),
      prefixo,
      numeroFogo,
      marca: riscadoForm.marca === "Outra" ? safeText(riscadoForm.marcaOutra) : safeText(riscadoForm.marca),
      mmAntes: safeText(riscadoForm.mmAntes),
      mmDepois: safeText(riscadoForm.mmDepois),
      observacoes: safeText(riscadoForm.observacoes),
      fotoFile: riscadoForm.foto,
      criadoPorLogin: safeText(user?.login || user?.email),
      criadoPorNome: safeText(user?.nome),
      criadoPorId: safeText(user?.auth_user_id || user?.id),
    };

    try {
      setSaving(true);
      await submitRiscadoPayload(payload);
      setRiscadoOpen(false);
      const data = await carregarRiscados();
      setRiscadoForm(createRiscadoForm(buildNextFicha(data, "ficha_riscado", "RP"), userName));
      alert("Pneu riscado salvo com sucesso.");
    } catch (error) {
      console.error("Erro ao salvar riscado:", error);
      alert(error?.message || "Nao foi possivel salvar o riscado.");
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

  async function marcarAuditoriaStatus(posicao, status) {
    if (!consulta.row?.id) return;

    const key = `auditoria:${posicao}`;
    try {
      setCheckingStatusKey(key);
      const nextPosicoes = getAuditoriaPosicoes(consulta.row).map((item) =>
        item.posicao === posicao
          ? {
              ...item,
              conferencia_status: status,
              conferencia_em: new Date().toISOString(),
              conferencia_por_nome: safeText(user?.nome),
              conferencia_por_login: safeText(user?.login || user?.email),
              conferencia_por_id: safeText(user?.auth_user_id || user?.id),
            }
          : item
      );

      const { error } = await supabase
        .from("pcm_auditoria_pneus")
        .update({ posicoes: nextPosicoes })
        .eq("id", consulta.row.id);

      if (error) throw error;

      const updatedRow = { ...consulta.row, posicoes: nextPosicoes };
      setAuditorias((current) => current.map((item) => (item.id === updatedRow.id ? updatedRow : item)));
      setConsulta((current) => ({ ...current, row: updatedRow }));
    } catch (error) {
      console.error("Erro ao conferir auditoria:", error);
      alert(error?.message || "Nao foi possivel atualizar a conferencia da auditoria.");
    } finally {
      setCheckingStatusKey("");
    }
  }

  async function marcarEstoqueStatus(itemId, status) {
    if (!itemId) return;

    const key = `estoque:${itemId}`;
    const payload = {
      transnet_status: status,
      transnet_conferido_em: new Date().toISOString(),
      transnet_conferido_por_nome: safeText(user?.nome),
      transnet_conferido_por_login: safeText(user?.login || user?.email),
      transnet_conferido_por_id: safeText(user?.auth_user_id || user?.id),
    };

    try {
      setCheckingStatusKey(key);
      const { error } = await supabase.from("pcm_estoque_pneus").update(payload).eq("id", itemId);
      if (error) throw error;

      setEstoqueRows((current) =>
        current.map((item) => (item.id === itemId ? { ...item, ...payload } : item))
      );

      const updatedGroup = {
        ...consulta.row,
        itens: (consulta.row?.itens || []).map((item) =>
          item.id === itemId ? { ...item, ...payload } : item
        ),
      };
      setConsulta((current) => ({ ...current, row: updatedGroup }));
    } catch (error) {
      console.error("Erro ao conferir estoque:", error);
      alert(error?.message || "Nao foi possivel atualizar a conferencia do estoque.");
    } finally {
      setCheckingStatusKey("");
    }
  }

  async function marcarConsertoStatus(itemId, status) {
    if (!itemId) return;

    const nowIso = new Date().toISOString();
    const key = `conserto:${itemId}:${status}`;
    const payload = {
      status,
      ...(status === "EM CONSERTO"
        ? {
            borracheiro_recebido_em: nowIso,
            borracheiro_nome: safeText(user?.nome),
            borracheiro_login: safeText(user?.login || user?.email),
            borracheiro_id: safeText(user?.auth_user_id || user?.id),
          }
        : {}),
      ...(status === "CONCLUIDO"
        ? {
            borracheiro_recebido_em: consulta.row?.borracheiro_recebido_em || nowIso,
            borracheiro_nome: consulta.row?.borracheiro_nome || safeText(user?.nome),
            borracheiro_login: consulta.row?.borracheiro_login || safeText(user?.login || user?.email),
            borracheiro_id: consulta.row?.borracheiro_id || safeText(user?.auth_user_id || user?.id),
            baixa_em: nowIso,
            baixa_por_nome: safeText(user?.nome),
            baixa_por_login: safeText(user?.login || user?.email),
            baixa_por_id: safeText(user?.auth_user_id || user?.id),
          }
        : {}),
    };

    try {
      setCheckingStatusKey(key);
      const { error } = await supabase.from("pcm_consertos_pneus").update(payload).eq("id", itemId);
      if (error) throw error;

      setConsertos((current) =>
        current.map((item) => (item.id === itemId ? { ...item, ...payload } : item))
      );
      if (consulta.row?.id === itemId) {
        setConsulta((current) => ({ ...current, row: { ...current.row, ...payload } }));
      }
      alert(status === "CONCLUIDO" ? "Conserto baixado com sucesso." : "Conserto atualizado com sucesso.");
    } catch (error) {
      console.error("Erro ao atualizar conserto:", error);
      alert(error?.message || "Nao foi possivel atualizar o conserto.");
    } finally {
      setCheckingStatusKey("");
    }
  }

  async function marcarRiscadoStatus(itemId, status) {
    if (!itemId) return;

    const key = `riscado:${itemId}:${status}`;
    const payload = {
      status,
      ...(status === "RESOLVIDO" ? { ultimo_alerta_ciclo: buildAlertCycle(diffDaysFromToday(consulta.row?.data_riscado)) } : {}),
    };

    try {
      setCheckingStatusKey(key);
      const { error } = await supabase.from("pcm_riscados_pneus").update(payload).eq("id", itemId);
      if (error) throw error;

      setRiscados((current) =>
        current.map((item) => (item.id === itemId ? { ...item, ...payload } : item))
      );
      if (consulta.row?.id === itemId) {
        setConsulta((current) => ({ ...current, row: { ...current.row, ...payload } }));
      }
      alert("Status do riscado atualizado com sucesso.");
    } catch (error) {
      console.error("Erro ao atualizar riscado:", error);
      alert(error?.message || "Nao foi possivel atualizar o riscado.");
    } finally {
      setCheckingStatusKey("");
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
        conserto_vinculado: row.consertoRelacionado?.situacao_origem || "",
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
          base[`${key}_calibragem`] = item.calibragem || "";
          base[`${key}_sulco`] = item.sulco || "";
          base[`${key}_conferencia`] = item.conferencia_status || "Pendente";
          base[`${key}_foto`] = item.foto_url || "";
        });

        return base;
      });

      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheet), "Auditoria");
      XLSX.writeFile(wb, "pcm_auditoria_pneus.xlsx");
      return;
    }

      const sheet = estoqueFiltrado.flatMap((row) =>
      (row.itens || []).map((item) => ({
        ficha: row.ficha_estoque,
        data: formatDate(row.created_at),
        quem_lancou: row.criado_por_nome || row.criado_por_login,
        numero_fogo: item.numero_fogo || item.numero_pneu,
        numero_interno: item.numero_pneu || "",
        marca: item.marca,
        situacao: item.situacao,
        conferencia: item.transnet_status || "Pendente",
        conferido_em: item.transnet_conferido_em ? formatDate(item.transnet_conferido_em) : "",
        conferido_por: item.transnet_conferido_por_nome || item.transnet_conferido_por_login || "",
        observacoes: row.observacoes || "",
      }))
    );

    if (activeTab === TAB_ESTOQUE) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheet), "Estoque");
      XLSX.writeFile(wb, "pcm_estoque_pneus.xlsx");
      return;
    }

    if (activeTab === TAB_CONSERTOS) {
      const consertosSheet = consertosFiltrados.map((row) => ({
        ficha: row.ficha_conserto,
        data: formatDate(row.created_at),
        origem: row.origem_tab,
        detalhe_origem: row.situacao_origem || "",
        prefixo: row.prefixo || "",
        numero_fogo: row.numero_fogo || "",
        situacao_origem: row.situacao_origem || "",
        status: row.status || "",
        borracheiro_recebido_em: row.borracheiro_recebido_em ? formatDate(row.borracheiro_recebido_em) : "",
        borracheiro: row.borracheiro_nome || row.borracheiro_login || "",
        baixa_em: row.baixa_em ? formatDate(row.baixa_em) : "",
        baixa_por: row.baixa_por_nome || row.baixa_por_login || "",
        observacoes: row.observacoes || "",
      }));

      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(consertosSheet), "Consertos");
      XLSX.writeFile(wb, "pcm_consertos_pneus.xlsx");
      return;
    }

    const riscadosSheet = riscadosFiltrados.map((row) => ({
      ficha: row.ficha_riscado,
      data_lancamento: formatDate(row.created_at),
      dia_riscado: formatDateOnly(row.data_riscado),
      prefixo: row.prefixo || "",
      numero_fogo: row.numero_fogo || "",
      marca: row.marca || "",
      mm_antes: row.mm_antes ?? "",
      mm_depois: row.mm_depois ?? "",
      status: row.status || "",
      dias_aberto: diffDaysFromToday(row.data_riscado),
      foto: row.foto_url || "",
      observacoes: row.observacoes || "",
    }));

    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(riscadosSheet), "Riscados");
    XLSX.writeFile(wb, "pcm_riscados_pneus.xlsx");
  }

  const actionLabel =
    activeTab === TAB_TROCA
      ? "Lancar troca de pneus"
      : activeTab === TAB_AUDITORIA
        ? "Lancar auditoria de pneus"
        : activeTab === TAB_ESTOQUE
        ? "Lancar estoque de pneus"
        : activeTab === TAB_CONSERTOS
          ? "Enviar pneu para conserto"
          : "Lancar pneu riscado";
  const nativePageStyle = isNativeShell
    ? {
        paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.85rem)",
        paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 5.75rem)",
      }
    : undefined;

  return (
    <div
      className="mx-auto min-h-screen max-w-7xl space-y-6 bg-slate-50 p-4 md:p-6"
      style={nativePageStyle}
    >
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
          {!isNativeShell ? (
            <button
              type="button"
              onClick={exportarExcel}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
            >
              <FaDownload />
              Baixar Excel
            </button>
          ) : null}
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

      {!isOnline || offlineCount > 0 ? (
        <div className={`rounded-2xl border px-4 py-3 text-sm shadow-sm ${isOnline ? "border-amber-200 bg-amber-50 text-amber-800" : "border-rose-200 bg-rose-50 text-rose-800"}`}>
          {!isOnline ? "Sem internet. Você pode usar 'Salvar offline' e o app vai subir depois automaticamente." : null}
          {offlineCount > 0 ? ` ${offlineCount} envio(s) pendente(s) na fila${syncingOffline ? " · sincronizando agora" : ""}.` : null}
        </div>
      ) : null}

      {!isNativeShell ? (
      <div className="flex gap-3 overflow-x-auto pb-1">
          <TabButton
            active={activeTab === TAB_TROCA}
            onClick={() => handleTabChange(TAB_TROCA)}
            icon={<FaClipboardList className="text-blue-600" />}
            title="Troca de pneus"
            count={trocas.length}
          />
          <TabButton
            active={activeTab === TAB_AUDITORIA}
            onClick={() => handleTabChange(TAB_AUDITORIA)}
            icon={<FaClipboardCheck className="text-violet-600" />}
            title="Auditoria de pneus"
            count={auditorias.length}
          />
          <TabButton
            active={activeTab === TAB_ESTOQUE}
            onClick={() => handleTabChange(TAB_ESTOQUE)}
            icon={<FaWarehouse className="text-amber-600" />}
            title="Estoque de pneus"
            count={estoqueRows.length}
          />
          <TabButton
            active={activeTab === TAB_CONSERTOS}
            onClick={() => handleTabChange(TAB_CONSERTOS)}
            icon={<FaTools className="text-orange-600" />}
            title="Consertos"
            count={consertos.length}
          />
          <TabButton
            active={activeTab === TAB_RISCADOS}
            onClick={() => handleTabChange(TAB_RISCADOS)}
            icon={<FaExclamationTriangle className="text-rose-600" />}
            title="Riscados"
            count={riscados.length}
          />
      </div>
      ) : null}

      {alertasAbertos.length ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-amber-900">
              <FaBell />
              Alertas ativos
            </div>
            <button
              type="button"
              onClick={() => setAlertasAbertos([])}
              className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100"
            >
              Fechar alertas
            </button>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {alertasAbertos.map((alerta) => (
              <div key={alerta.id} className="rounded-xl border border-amber-200 bg-white px-4 py-3">
                <div className="text-sm font-bold text-slate-800">{alerta.title}</div>
                <div className="mt-1 text-sm text-slate-600">{alerta.message}</div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {activeTab === TAB_TROCA ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
          <CardResumo label="Total" value={cardsTroca.total} color="text-slate-900" compact={isNativeShell} />
          <CardResumo label="Lançadas Transnet" value={cardsTroca.transnetLancadas} color="text-emerald-600" compact={isNativeShell} />
          <CardResumo label="Pendentes Transnet" value={cardsTroca.transnetPendentes} color="text-rose-600" compact={isNativeShell} />
          <CardResumo label="Estoque para carro" value={cardsTroca.estoqueCarro} color="text-blue-600" compact={isNativeShell} />
          <CardResumo label="Carro para carro" value={cardsTroca.carroCarro} color="text-orange-600" compact={isNativeShell} />
        </div>
      ) : null}

      {activeTab === TAB_AUDITORIA ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
            <CardResumo label="Total" value={cardsAuditoria.total} color="text-slate-900" compact={isNativeShell} />
            <CardResumo label="Pendentes" value={cardsAuditoria.pendentes} color="text-amber-600" compact={isNativeShell} />
            <CardResumo label="Concluídas" value={cardsAuditoria.concluidas} color="text-emerald-600" compact={isNativeShell} />
            <CardResumo label="Com incorreto" value={cardsAuditoria.incorretas} color="text-rose-600" compact={isNativeShell} />
            <CardResumo label="30+ dias sem auditoria" value={auditoriasAtrasadas.length} color="text-rose-600" compact={isNativeShell} />
          </div>

          {auditoriasAtrasadas.length ? (
            <div className="flex flex-col gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-900 md:flex-row md:items-center md:justify-between">
              <div>
                Existem <strong>{auditoriasAtrasadas.length}</strong> carro(s) sem auditoria há mais de 30 dias.
              </div>
              <button
                type="button"
                onClick={() => setAuditoriaPendenciasOpen(true)}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-rose-600 px-4 py-2.5 font-semibold text-white hover:bg-rose-700"
              >
                <FaClipboardCheck />
                Ver carros sem auditoria
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {activeTab === TAB_ESTOQUE ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
          <CardResumo label="Última ficha" value={cardsEstoque.ficha} color="text-slate-900" compact={isNativeShell} />
          <CardResumo label="Pneus na última" value={cardsEstoque.total} color="text-blue-600" compact={isNativeShell} />
          <CardResumo label="OK" value={cardsEstoque.ok} color="text-emerald-600" compact={isNativeShell} />
          <CardResumo label="Incorretos" value={cardsEstoque.incorretos} color="text-rose-600" compact={isNativeShell} />
          <CardResumo label="Pendentes" value={cardsEstoque.pendentes} color="text-amber-600" compact={isNativeShell} />
          </div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
            <CardResumo label="Novo" value={cardsEstoque.novo} color="text-blue-600" compact={isNativeShell} />
            <CardResumo label="Para uso" value={cardsEstoque.uso} color="text-emerald-600" compact={isNativeShell} />
            <CardResumo label="Recapagem" value={cardsEstoque.recapagem} color="text-amber-600" compact={isNativeShell} />
            <CardResumo label="Recapado" value={cardsEstoque.recapado} color="text-violet-600" compact={isNativeShell} />
            <CardResumo label="Sucata" value={cardsEstoque.sucata} color="text-rose-600" compact={isNativeShell} />
          </div>
        </div>
      ) : null}

      {activeTab === TAB_CONSERTOS ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <CardResumo label="Total" value={cardsConsertos.total} color="text-slate-900" compact={isNativeShell} />
          <CardResumo label="Pendentes" value={cardsConsertos.pendentes} color="text-amber-600" compact={isNativeShell} />
          <CardResumo label="Em conserto" value={cardsConsertos.emConserto} color="text-blue-600" compact={isNativeShell} />
          <CardResumo label="Concluídos" value={cardsConsertos.concluidos} color="text-emerald-600" compact={isNativeShell} />
        </div>
      ) : null}

      {activeTab === TAB_RISCADOS ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <CardResumo label="Total" value={cardsRiscados.total} color="text-slate-900" compact={isNativeShell} />
          <CardResumo label="Abertos" value={cardsRiscados.abertos} color="text-rose-600" compact={isNativeShell} />
          <CardResumo label="Acompanhando" value={cardsRiscados.acompanhando} color="text-blue-600" compact={isNativeShell} />
          <CardResumo label="Com 10+ dias" value={cardsRiscados.vencidos10Dias} color="text-amber-600" compact={isNativeShell} />
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
                placeholder="Buscar ficha, prefixo ou numero de fogo..."
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
                placeholder="Buscar ficha, numero de fogo ou marca..."
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

        {activeTab === TAB_CONSERTOS ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
            <div className="relative md:col-span-2">
              <FaSearch className="absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar ficha, numero de fogo ou prefixo..."
                value={consertoFiltros.busca}
                onChange={(event) => setConsertoFiltros((current) => ({ ...current, busca: event.target.value }))}
                className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-10 pr-3 text-sm text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            <input
              type="date"
              value={consertoFiltros.dataInicio}
              onChange={(event) => setConsertoFiltros((current) => ({ ...current, dataInicio: event.target.value }))}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
            <input
              type="date"
              value={consertoFiltros.dataFim}
              onChange={(event) => setConsertoFiltros((current) => ({ ...current, dataFim: event.target.value }))}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
            <SelectField
              label="Status"
              value={consertoFiltros.status}
              onChange={(value) => setConsertoFiltros((current) => ({ ...current, status: value }))}
              options={["", ...SITUACOES_CONSERTO]}
            />
          </div>
        ) : null}

        {activeTab === TAB_RISCADOS ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
            <div className="relative md:col-span-2">
              <FaSearch className="absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar ficha, numero de fogo ou prefixo..."
                value={riscadoFiltros.busca}
                onChange={(event) => setRiscadoFiltros((current) => ({ ...current, busca: event.target.value }))}
                className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-10 pr-3 text-sm text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            <input
              type="date"
              value={riscadoFiltros.dataInicio}
              onChange={(event) => setRiscadoFiltros((current) => ({ ...current, dataInicio: event.target.value }))}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
            <input
              type="date"
              value={riscadoFiltros.dataFim}
              onChange={(event) => setRiscadoFiltros((current) => ({ ...current, dataFim: event.target.value }))}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
            <SelectField
              label="Status"
              value={riscadoFiltros.status}
              onChange={(value) => setRiscadoFiltros((current) => ({ ...current, status: value }))}
              options={["", ...SITUACOES_RISCADO]}
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
                      {row.consertoRelacionado ? (
                        <div className="mt-1 text-xs font-semibold text-amber-700">
                          Conserto: {row.consertoRelacionado.situacao_origem || buildTrocaConsertoResumo(row.pneu_conserto)}
                        </div>
                      ) : null}
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
                      <td colSpan={8} className="px-6 py-8 text-center text-slate-500">
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
                        <td className="px-4 py-3 text-slate-600">
                          <div>{buildTrocaResumo(row)}</div>
                          {row.consertoRelacionado ? (
                            <div className="mt-1 text-xs font-semibold text-amber-700">
                              Conserto: {row.consertoRelacionado.situacao_origem || buildTrocaConsertoResumo(row.pneu_conserto)}
                            </div>
                          ) : null}
                        </td>
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
            {auditoriasAtrasadas.length ? (
              <button
                type="button"
                onClick={() => setAuditoriaPendenciasOpen(true)}
                className="w-full rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-left shadow-sm"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-black uppercase tracking-wide text-rose-700">Sem auditoria 30+ dias</div>
                    <div className="mt-1 text-sm text-rose-900">
                      {auditoriasAtrasadas.length} carro(s) aguardando auditoria. Toque para abrir a lista.
                    </div>
                  </div>
                  <FaClipboardCheck className="shrink-0 text-xl text-rose-600" />
                </div>
              </button>
            ) : null}
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
                    <th className="px-4 py-3">Conferencia</th>
                    <th className="px-4 py-3 text-right">Acoes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {!loading && auditoriasFiltradas.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-8 text-center text-slate-500">
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
                        <td className="px-4 py-3 text-slate-600"><BadgeList items={getAuditoriaConferenciaCounts(row)} /></td>
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
                      <div className="text-sm font-bold text-slate-900">{row.ficha_estoque || "-"}</div>
                      <div className="mt-1 text-xs text-slate-500">{row.itens.length} pneus no lancamento</div>
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
                    <th className="px-4 py-3">Quantidade</th>
                    <th className="px-4 py-3">Numeros</th>
                    <th className="px-4 py-3">Situacoes</th>
                    <th className="px-4 py-3">Conferencia</th>
                    <th className="px-4 py-3">Quem lancou</th>
                    <th className="px-4 py-3 text-right">Acoes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {!loading && estoqueFiltrado.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-8 text-center text-slate-500">
                        Nenhum item de estoque encontrado com os filtros atuais.
                      </td>
                    </tr>
                  ) : (
                    estoqueFiltrado.map((row) => (
                      <tr key={row.id} className="transition-colors hover:bg-slate-50/80">
                        <td className="px-4 py-3 font-bold text-slate-700">{row.ficha_estoque}</td>
                        <td className="px-4 py-3 text-slate-600">{formatDate(row.created_at)}</td>
                        <td className="px-4 py-3 font-medium text-slate-700">{row.itens.length}</td>
                        <td className="px-4 py-3 text-slate-600"><EstoqueNumerosPreview row={row} /></td>
                        <td className="px-4 py-3 text-slate-600"><BadgeList items={getEstoqueSituacaoCounts(row)} /></td>
                        <td className="px-4 py-3 text-slate-600"><BadgeList items={getEstoqueConferenciaCounts(row)} /></td>
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

      {activeTab === TAB_CONSERTOS ? (
        isNativeShell ? (
          <div className="space-y-3">
            {!loading && consertosFiltrados.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white px-6 py-8 text-center text-slate-500 shadow-sm">
                Nenhum conserto encontrado com os filtros atuais.
              </div>
            ) : (
              consertosFiltrados.map((row) => (
                <div
                  key={row.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => openConsulta(TAB_CONSERTOS, row)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openConsulta(TAB_CONSERTOS, row); } }}
                  className="cursor-pointer rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm hover:bg-slate-50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-left text-xs font-black uppercase tracking-wide text-blue-700">
                        {row.ficha_conserto || "Ficha de conserto"}
                      </div>
                      <div className="text-sm font-bold text-slate-900">{row.numero_fogo || "-"}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {row.prefixo ? `Prefixo ${row.prefixo} · ` : ""}{row.status || "PENDENTE"}
                      </div>
                    </div>
                    <div className="text-right text-xs text-slate-500">{formatDate(row.created_at)}</div>
                  </div>
                  {row.situacao_origem ? (
                    <div className="mt-2 text-xs font-semibold text-amber-700">{row.situacao_origem}</div>
                  ) : null}
                  <div className="mt-3 grid grid-cols-2 gap-2" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => marcarConsertoStatus(row.id, "EM CONSERTO")}
                      disabled={checkingStatusKey === `conserto:${row.id}:EM CONSERTO` || norm(row.status) === "EM CONSERTO"}
                      className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                    >
                      Receber
                    </button>
                    <button
                      type="button"
                      onClick={() => marcarConsertoStatus(row.id, "CONCLUIDO")}
                      disabled={checkingStatusKey === `conserto:${row.id}:CONCLUIDO` || norm(row.status) === "CONCLUIDO"}
                      className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                    >
                      Dar baixa
                    </button>
                  </div>
                </div>
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
                    <th className="px-4 py-3">Numero de fogo</th>
                    <th className="px-4 py-3">Prefixo</th>
                    <th className="px-4 py-3">Origem</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Borracheiro</th>
                    <th className="px-4 py-3 text-right">Acoes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {!loading && consertosFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-8 text-center text-slate-500">
                        Nenhum conserto encontrado com os filtros atuais.
                      </td>
                    </tr>
                  ) : (
                    consertosFiltrados.map((row) => (
                      <tr
                        key={row.id}
                        onClick={() => openConsulta(TAB_CONSERTOS, row)}
                        className="cursor-pointer transition-colors hover:bg-slate-50/80"
                      >
                        <td className="px-4 py-3 font-bold text-slate-700">
                          <span className="text-blue-700 hover:underline">
                            {row.ficha_conserto}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{formatDate(row.created_at)}</td>
                        <td className="px-4 py-3 font-medium text-slate-700">{row.numero_fogo || "-"}</td>
                        <td className="px-4 py-3 text-slate-600">{row.prefixo || "-"}</td>
                        <td className="px-4 py-3 text-slate-600">{row.situacao_origem || row.origem_tab || "-"}</td>
                        <td className="px-4 py-3 text-slate-600">{row.status || "-"}</td>
                        <td className="px-4 py-3 text-slate-600">{row.borracheiro_nome || row.borracheiro_login || "-"}</td>
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => marcarConsertoStatus(row.id, "EM CONSERTO")}
                              disabled={checkingStatusKey === `conserto:${row.id}:EM CONSERTO` || norm(row.status) === "EM CONSERTO"}
                              className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                            >
                              Receber
                            </button>
                            <button
                              type="button"
                              onClick={() => marcarConsertoStatus(row.id, "CONCLUIDO")}
                              disabled={checkingStatusKey === `conserto:${row.id}:CONCLUIDO` || norm(row.status) === "CONCLUIDO"}
                              className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                            >
                              Dar baixa
                            </button>
                          </div>
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

      {activeTab === TAB_RISCADOS ? (
        isNativeShell ? (
          <div className="space-y-3">
            {!loading && riscadosFiltrados.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white px-6 py-8 text-center text-slate-500 shadow-sm">
                Nenhum pneu riscado encontrado com os filtros atuais.
              </div>
            ) : (
              riscadosFiltrados.map((row) => (
                <div key={row.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-bold text-slate-900">{row.numero_fogo || "-"}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {row.prefixo ? `Prefixo ${row.prefixo} · ` : ""}{row.status || "ABERTO"}
                      </div>
                    </div>
                    <div className="text-right text-xs text-slate-500">{diffDaysFromToday(row.data_riscado)} dia(s)</div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => marcarRiscadoStatus(row.id, "ACOMPANHANDO")}
                      disabled={checkingStatusKey === `riscado:${row.id}:ACOMPANHANDO` || norm(row.status) === "ACOMPANHANDO"}
                      className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                    >
                      Acompanhar
                    </button>
                    <button
                      type="button"
                      onClick={() => marcarRiscadoStatus(row.id, "RESOLVIDO")}
                      disabled={checkingStatusKey === `riscado:${row.id}:RESOLVIDO` || norm(row.status) === "RESOLVIDO"}
                      className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                    >
                      Resolver
                    </button>
                  </div>
                </div>
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
                    <th className="px-4 py-3">Dia</th>
                    <th className="px-4 py-3">Prefixo</th>
                    <th className="px-4 py-3">Numero de fogo</th>
                    <th className="px-4 py-3">MM antes</th>
                    <th className="px-4 py-3">MM depois</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Foto</th>
                    <th className="px-4 py-3 text-right">Acoes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {!loading && riscadosFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-6 py-8 text-center text-slate-500">
                        Nenhum pneu riscado encontrado com os filtros atuais.
                      </td>
                    </tr>
                  ) : (
                    riscadosFiltrados.map((row) => (
                      <tr key={row.id} className="transition-colors hover:bg-slate-50/80">
                        <td className="px-4 py-3 font-bold text-slate-700">{row.ficha_riscado}</td>
                        <td className="px-4 py-3 text-slate-600">{formatDateOnly(row.data_riscado)}</td>
                        <td className="px-4 py-3 text-slate-600">{row.prefixo || "-"}</td>
                        <td className="px-4 py-3 font-medium text-slate-700">{row.numero_fogo || "-"}</td>
                        <td className="px-4 py-3 text-slate-600">{row.mm_antes ?? "-"}</td>
                        <td className="px-4 py-3 text-slate-600">{row.mm_depois ?? "-"}</td>
                        <td className="px-4 py-3 text-slate-600">{row.status || "-"}</td>
                        <td className="px-4 py-3 text-slate-600">
                          {row.foto_url ? (
                            <a href={row.foto_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                              Ver foto
                            </a>
                          ) : "-"}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => marcarRiscadoStatus(row.id, "ACOMPANHANDO")}
                              disabled={checkingStatusKey === `riscado:${row.id}:ACOMPANHANDO` || norm(row.status) === "ACOMPANHANDO"}
                              className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                            >
                              Acompanhar
                            </button>
                            <button
                              type="button"
                              onClick={() => marcarRiscadoStatus(row.id, "RESOLVIDO")}
                              disabled={checkingStatusKey === `riscado:${row.id}:RESOLVIDO` || norm(row.status) === "RESOLVIDO"}
                              className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                            >
                              Resolver
                            </button>
                          </div>
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
        onCapturePhoto={captureTrocaPhoto}
        onSalvarOffline={() => salvarTroca("offline")}
        onSalvar={salvarTroca}
        isNativeShell={isNativeShell}
      />

      <AuditoriaModal
        open={auditoriaOpen}
        form={auditoriaForm}
        saving={saving}
        onClose={() => setAuditoriaOpen(false)}
        onFieldChange={updateAuditoriaField}
        onPosicaoChange={updateAuditoriaPosicao}
        onCapturePhoto={captureAuditoriaPhoto}
        onSalvarOffline={() => salvarAuditoria("offline")}
        onSalvar={salvarAuditoria}
        isNativeShell={isNativeShell}
      />

      <EstoqueModal
        open={estoqueOpen}
        form={estoqueForm}
        saving={saving}
        onClose={() => setEstoqueOpen(false)}
        onFieldChange={updateEstoqueField}
        onItemChange={updateEstoqueItem}
        onAddItem={addEstoqueItem}
        onRemoveItem={removeEstoqueItem}
        onCopiarEstoqueAnterior={copiarEstoqueAnterior}
        onSalvarOffline={() => salvarEstoque("offline")}
        onSalvar={salvarEstoque}
      />

      <ConsertoModal
        open={consertoOpen}
        form={consertoForm}
        saving={saving}
        onClose={() => setConsertoOpen(false)}
        onFieldChange={updateConsertoField}
        onSalvar={salvarConserto}
      />

      <RiscadoModal
        open={riscadoOpen}
        form={riscadoForm}
        saving={saving}
        onClose={() => setRiscadoOpen(false)}
        onFieldChange={updateRiscadoField}
        onFotoChange={(file) => setRiscadoForm((current) => ({ ...current, foto: file }))}
        onCapturePhoto={captureRiscadoPhoto}
        onSalvar={salvarRiscado}
        isNativeShell={isNativeShell}
      />

      <AuditoriaPendenciasModal
        open={auditoriaPendenciasOpen}
        rows={auditoriasAtrasadas}
        onClose={() => setAuditoriaPendenciasOpen(false)}
        onLancar={lancarAuditoriaParaPrefixo}
      />

      <ConsultaModal
        open={consulta.open}
        tab={consulta.tab}
        row={consulta.row}
        transnetSaving={transnetSaving}
        checkingStatusKey={checkingStatusKey}
        isNativeShell={isNativeShell}
        onClose={closeConsulta}
        onMarcarTransnet={marcarTransnet}
        onMarcarAuditoriaStatus={marcarAuditoriaStatus}
        onMarcarEstoqueStatus={marcarEstoqueStatus}
        onMarcarConsertoStatus={marcarConsertoStatus}
        onEnviarConserto={abrirConsertoPreenchido}
        onAbrirRiscado={abrirRiscadoPreenchido}
        getConsertoSourceMeta={getConsertoSourceMeta}
      />

    </div>
  );
}
