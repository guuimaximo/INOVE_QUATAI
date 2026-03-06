// src/pages/PCMDiario.jsx
import { useState, useEffect, useCallback, useContext, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import { AuthContext } from "../context/AuthContext";
import {
  FaDownload,
  FaArrowLeft,
  FaTruckLoading,
  FaSearch,
  FaFilter,
  FaEdit,
  FaTimes,
  FaSave,
  FaCheckCircle,
} from "react-icons/fa";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf"; // ✅ PDF real (sem print)

/* ============================
   CONSTANTES (PADRÃO)
============================ */

const SETORES = ["GARANTIA", "MANUTENÇÃO", "SUPRIMENTOS"];

const OBS_OPCOES = ["AG. CHEGADA DE PEÇAS", "AG. EXECUÇÃO DO SERVIÇO", "AG. GARANTIA"];

// ✅ ORDEM DEFINIDA:
// GNS → FAIXA AMARELA → NOITE → PENDENTES → VENDA
const CATEGORIAS = [
  { value: "GNS", label: "GNS", color: "bg-red-600 text-white", badge: "bg-red-600 text-white" },

  // ✅ NOVA CATEGORIA (linha amarela)
  {
    value: "FAIXA_AMARELA",
    label: "Faixa Amarela",
    color: "bg-yellow-300 text-black",
    badge: "bg-yellow-500 text-black",
  },

  {
    value: "NOITE",
    label: "Liberação Noturno",
    color: "bg-white text-gray-900",
    badge: "bg-gray-900 text-white",
  },
  { value: "PENDENTES", label: "Pendentes", color: "bg-gray-500 text-white", badge: "bg-gray-500 text-white" },
  { value: "VENDA", label: "Venda", color: "bg-blue-600 text-white", badge: "bg-blue-600 text-white" },
];

/* ============================
   HELPERS
============================ */

function getCategoriaStyle(cat) {
  const found = CATEGORIAS.find((c) => c.value === cat);
  return (
    found || {
      value: cat,
      label: cat,
      color: "bg-gray-200 text-gray-800",
      badge: "bg-gray-200 text-gray-800",
    }
  );
}

function formatBRDate(dt) {
  try {
    if (!dt) return "-";
    return new Date(dt).toLocaleDateString("pt-BR");
  } catch {
    return "-";
  }
}

function daysBetween(inicioISO) {
  try {
    if (!inicioISO) return 0;
    const d0 = new Date(inicioISO);
    const diff = Date.now() - d0.getTime();
    return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
  } catch {
    return 0;
  }
}

function buildDiff(before, after, keys) {
  const diff = {};
  keys.forEach((k) => {
    const a = before?.[k] ?? null;
    const b = after?.[k] ?? null;
    if (String(a ?? "") !== String(b ?? "")) {
      diff[k] = { de: a, para: b };
    }
  });
  return diff;
}

/**
 * PCM editável até 10:00 do dia seguinte (horário local do navegador)
 * Ex:
 * dataRef = 2026-01-20
 * deadline = 2026-01-21 10:00:00
 */
function canEditPCM(dataRefISO) {
  try {
    if (!dataRefISO) return false;

    const ref = new Date(`${dataRefISO}T00:00:00`);
    const deadline = new Date(ref);
    deadline.setDate(deadline.getDate() + 1);
    deadline.setHours(10, 0, 0, 0);

    return Date.now() <= deadline.getTime();
  } catch {
    return false;
  }
}

/* ============================
   UI: MULTISELECT (CHIPS)
============================ */

function MultiSelectChips({ label, options, values, onChange }) {
  const set = useMemo(() => new Set(values || []), [values]);

  function toggle(v) {
    const next = new Set(set);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    onChange(Array.from(next));
  }

  function clear() {
    onChange([]);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {label ? <div className="text-[10px] font-black text-gray-500 uppercase mr-1">{label}:</div> : null}

      {options.map((opt) => {
        const active = set.has(opt.value);
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => toggle(opt.value)}
            className={`px-3 py-2 rounded-lg text-xs font-black border transition-all ${
              active ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-800 hover:bg-gray-100"
            }`}
            title={active ? "Remover filtro" : "Adicionar filtro"}
          >
            {opt.label}
          </button>
        );
      })}

      {(values || []).length > 0 && (
        <button
          type="button"
          onClick={clear}
          className="px-3 py-2 rounded-lg text-xs font-black bg-gray-100 hover:bg-gray-200"
        >
          Limpar
        </button>
      )}
    </div>
  );
}

/* ============================
   MODAL EDITAR (1 BOTÃO)
============================ */

function EditarVeiculoModal({ open, onClose, veiculo, prefixos, onSalvar }) {
  const [saving, setSaving] = useState(false);

  const [draft, setDraft] = useState({
    frota: "",
    setor: "",
    ordem_servico: "",
    descricao: "",
    observacao: "",
    categoria: "",
  });

  useEffect(() => {
    if (!open || !veiculo) return;
    setDraft({
      frota: veiculo.frota || "",
      setor: veiculo.setor || "MANUTENÇÃO",
      ordem_servico: String(veiculo.ordem_servico || ""),
      descricao: veiculo.descricao || "",
      observacao: veiculo.observacao || "",
      categoria: veiculo.categoria || "GNS",
    });
  }, [open, veiculo]);

  // ✅ REGRAS DE MOVIMENTAÇÃO
  // Pedido: FAIXA_AMARELA pode ir para GNS, PENDENTES, NOITE (e ficar nela)
  // Mantive NOITE com regra original (NOITE -> GNS). Se quiser permitir NOITE -> FAIXA_AMARELA,
  // altere a linha do NOITE abaixo para incluir "FAIXA_AMARELA".
  const opcoesCategoriaPermitidas = useMemo(() => {
    const atual = veiculo?.categoria;

    if (atual === "PENDENTES") return ["PENDENTES", "GNS", "FAIXA_AMARELA", "NOITE"];
    if (atual === "NOITE") return ["NOITE", "GNS"]; // <- se quiser, troque por ["NOITE","GNS","FAIXA_AMARELA"]
    if (atual === "GNS") return ["GNS", "FAIXA_AMARELA", "PENDENTES", "NOITE"];
    if (atual === "FAIXA_AMARELA") return ["FAIXA_AMARELA", "GNS", "PENDENTES", "NOITE"];
    if (atual === "VENDA") return ["VENDA", "GNS", "FAIXA_AMARELA", "PENDENTES", "NOITE"];

    return ["GNS", "FAIXA_AMARELA", "PENDENTES", "NOITE", "VENDA"];
  }, [veiculo]);

  if (!open || !veiculo) return null;

  const catAtual = veiculo.categoria || "-";

  async function handleSalvar() {
    const os = String(draft.ordem_servico || "").trim();

    if (!draft.frota) return alert("Frota é obrigatória.");
    if (!os) return alert("Ordem de Serviço é obrigatória.");
    if (!/^\d+$/.test(os)) return alert("Ordem de Serviço deve conter somente números.");
    if (!draft.setor) return alert("Setor é obrigatório.");
    if (!draft.observacao) return alert("Selecione uma Observação.");

    const payloadUpdate = {
      frota: draft.frota,
      setor: draft.setor,
      ordem_servico: os,
      descricao: draft.descricao,
      observacao: draft.observacao,
      categoria: draft.categoria,
    };

    const diff = buildDiff(veiculo, payloadUpdate, ["frota", "setor", "ordem_servico", "descricao", "observacao", "categoria"]);

    if (!Object.keys(diff).length) {
      return alert("Nenhuma alteração para salvar.");
    }

    setSaving(true);
    try {
      const deCat = veiculo.categoria || null;
      const paraCat = payloadUpdate.categoria || null;
      const acao = deCat !== paraCat ? "MOVER_CATEGORIA" : "EDITAR";

      await onSalvar(payloadUpdate, acao, deCat, paraCat, diff);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <div>
            <div className="text-xs font-black text-gray-500 uppercase">Editar veículo</div>
            <div className="text-lg font-black text-gray-900">
              Frota: {veiculo.frota}{" "}
              <span className="ml-2 text-xs font-black px-2 py-1 rounded-full bg-gray-100">
                Atual: {catAtual}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100" title="Fechar">
            <FaTimes />
          </button>
        </div>

        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col">
            <label className="text-[10px] font-black text-gray-500 uppercase mb-1">Frota</label>
            <select
              className="border rounded-lg px-3 py-2 text-sm font-bold"
              value={draft.frota}
              onChange={(e) => setDraft({ ...draft, frota: e.target.value })}
            >
              <option value="">Selecione...</option>
              {(prefixos || []).map((p) => (
                <option key={p.codigo} value={p.codigo}>
                  {p.codigo}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col">
            <label className="text-[10px] font-black text-gray-500 uppercase mb-1">Setor</label>
            <select
              className="border rounded-lg px-3 py-2 text-sm font-bold"
              value={draft.setor}
              onChange={(e) => setDraft({ ...draft, setor: e.target.value })}
            >
              {SETORES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col">
            <label className="text-[10px] font-black text-gray-500 uppercase mb-1">Ordem de Serviço (somente números)</label>
            <input
              className="border rounded-lg px-3 py-2 text-sm font-bold"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={draft.ordem_servico}
              onChange={(e) => setDraft({ ...draft, ordem_servico: e.target.value.replace(/\D/g, "") })}
              placeholder="Ex: 123456"
              required
            />
          </div>

          <div className="flex flex-col">
            <label className="text-[10px] font-black text-gray-500 uppercase mb-1">Observação</label>
            <select
              className="border rounded-lg px-3 py-2 text-sm font-bold"
              value={draft.observacao}
              onChange={(e) => setDraft({ ...draft, observacao: e.target.value })}
            >
              <option value="">Selecione...</option>
              {OBS_OPCOES.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col md:col-span-2">
            <label className="text-[10px] font-black text-gray-500 uppercase mb-1">Descrição</label>
            <input
              className="border rounded-lg px-3 py-2 text-sm font-bold"
              type="text"
              value={draft.descricao}
              onChange={(e) => setDraft({ ...draft, descricao: e.target.value })}
              placeholder="Defeito relatado..."
            />
          </div>

          <div className="flex flex-col md:col-span-2">
            <label className="text-[10px] font-black text-gray-500 uppercase mb-1">Categoria</label>
            <select
              className="border rounded-lg px-3 py-2 text-sm font-bold"
              value={draft.categoria}
              onChange={(e) => setDraft({ ...draft, categoria: e.target.value })}
            >
              {opcoesCategoriaPermitidas.map((c) => (
                <option key={c} value={c}>
                  {getCategoriaStyle(c).label}
                </option>
              ))}
            </select>

            <div className="text-[10px] text-gray-500 font-semibold mt-1">Regras aplicadas conforme categoria atual.</div>
          </div>
        </div>

        <div className="px-5 py-4 border-t bg-gray-50 flex flex-col md:flex-row gap-2 md:items-center md:justify-between">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 rounded-lg font-black text-sm bg-white border hover:bg-gray-100 disabled:opacity-60"
          >
            Cancelar
          </button>

          <button
            onClick={handleSalvar}
            disabled={saving}
            className="px-4 py-2 rounded-lg font-black text-sm bg-gray-900 text-white hover:bg-black disabled:opacity-60 flex items-center gap-2"
          >
            <FaSave /> Salvar alterações
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================
   PAGE
============================ */

export default function PCMDiario() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

  const [veiculos, setVeiculos] = useState([]);
  const [prefixos, setPrefixos] = useState([]);
  const [pcmInfo, setPcmInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  const [turnoAtivo, setTurnoAtivo] = useState("DIA");

  // filtros
  const [filtroTexto, setFiltroTexto] = useState("");
  const [filtroCategorias, setFiltroCategorias] = useState([]);
  const [filtroSetores, setFiltroSetores] = useState([]);
  const [filtroTurnos, setFiltroTurnos] = useState([]);
  const [filtroCluster, setFiltroCluster] = useState([]);

  // abas
  const [abaAtiva, setAbaAtiva] = useState("TODOS");

  const reportRef = useRef(null);

  // modal editar
  const [editOpen, setEditOpen] = useState(false);
  const [editVeiculo, setEditVeiculo] = useState(null);

  const [form, setForm] = useState({
    frota: "",
    setor: "MANUTENÇÃO",
    descricao: "",
    categoria: "GNS",
    ordem_servico: "",
    previsao: "",
    observacao: "",
  });

  // ✅ regra de bloqueio (até 10:00 do dia seguinte)
  const pcmEditavel = useMemo(() => canEditPCM(pcmInfo?.data_referencia), [pcmInfo?.data_referencia]);

  const buscarDados = useCallback(async () => {
    setLoading(true);

    const [resPcm, resVeiculos, resPrefixos] = await Promise.all([
      supabase.from("pcm_diario").select("*").eq("id", id).single(),
      supabase
        .from("veiculos_pcm")
        .select("*")
        .eq("pcm_id", id)
        .is("data_saida", null)
        .order("data_entrada", { ascending: true }),
      supabase.from("prefixos").select("codigo, cluster").order("codigo"),
    ]);

    if (resPcm?.data) setPcmInfo(resPcm.data);
    if (resPrefixos?.data) setPrefixos(resPrefixos.data);

    const mapClusterByCodigo = new Map();
    (resPrefixos?.data || []).forEach((p) => {
      const cod = String(p?.codigo || "").trim();
      if (cod) mapClusterByCodigo.set(cod, String(p?.cluster || "").trim());
    });

    const veicsComCluster = (resVeiculos?.data || []).map((v) => ({
      ...v,
      cluster: mapClusterByCodigo.get(String(v?.frota || "").trim()) || "",
    }));

    setVeiculos(veicsComCluster);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    buscarDados();
  }, [buscarDados]);

  async function gravarHistorico({ veiculo_pcm_id, pcm_id, frota, acao, de_categoria, para_categoria, alteracoes }) {
    const { error } = await supabase.from("veiculos_pcm_historico").insert([
      {
        veiculo_pcm_id,
        pcm_id,
        frota,
        acao,
        de_categoria,
        para_categoria,
        alteracoes: alteracoes || {},
        executado_por: user?.nome || "Sistema",
      },
    ]);

    if (error) {
      console.warn("Falha ao gravar histórico (ver RLS/tabela):", error);
    }
  }

  async function lancarVeiculo() {
    if (!pcmEditavel) {
      return alert("PCM fechado: permitido editar somente até 10:00 do dia seguinte.");
    }

    const os = String(form.ordem_servico || "").trim();

    if (!form.frota || !form.descricao) return alert("Preencha Frota e Descrição.");
    if (!os) return alert("Ordem de Serviço é obrigatória.");
    if (!/^\d+$/.test(os)) return alert("Ordem de Serviço deve conter somente números.");
    if (!form.setor) return alert("Setor é obrigatório.");
    if (!form.observacao) return alert("Selecione uma Observação.");

    const { data: jaExiste, error: errCheck } = await supabase
      .from("veiculos_pcm")
      .select("id")
      .eq("pcm_id", id)
      .eq("frota", form.frota)
      .is("data_saida", null)
      .limit(1);

    if (errCheck) {
      console.error(errCheck);
      return alert("Erro ao validar duplicidade.");
    }

    if (jaExiste && jaExiste.length > 0) {
      return alert(`A frota ${form.frota} já está lançada neste PCM (em aberto).`);
    }

    const payload = {
      pcm_id: id,
      ...form,
      ordem_servico: os,
      lancado_por: user?.nome || "Sistema",
      lancado_no_turno: turnoAtivo,
      data_entrada: new Date().toISOString(),
    };

    const { data: inserted, error } = await supabase.from("veiculos_pcm").insert([payload]).select("*").single();

    if (error) {
      console.error(error);
      return alert("Erro ao lançar veículo.");
    }

    await gravarHistorico({
      veiculo_pcm_id: inserted?.id,
      pcm_id: id,
      frota: inserted?.frota,
      acao: "LANCAR",
      de_categoria: null,
      para_categoria: inserted?.categoria || null,
      alteracoes: { lancamento: true },
    });

    setForm({
      ...form,
      frota: "",
      descricao: "",
      ordem_servico: "",
      observacao: "",
    });

    buscarDados();
  }

  async function liberarVeiculo(v) {
    if (!pcmEditavel) {
      return alert("PCM fechado: não é permitido liberar veículos após 10:00 do dia seguinte.");
    }

    if (!confirm(`Confirmar liberação da frota ${v.frota}?`)) return;

    const { error } = await supabase
      .from("veiculos_pcm")
      .update({
        data_saida: new Date().toISOString(),
        liberado_por: user?.nome || "Sistema",
      })
      .eq("id", v.id);

    if (error) {
      console.error(error);
      return alert("Erro ao liberar veículo.");
    }

    await gravarHistorico({
      veiculo_pcm_id: v.id,
      pcm_id: id,
      frota: v.frota,
      acao: "LIBERAR",
      de_categoria: v.categoria || null,
      para_categoria: v.categoria || null,
      alteracoes: { liberado_por: user?.nome || "Sistema" },
    });

    buscarDados();
  }

  async function salvarEdicaoVeiculo(payloadUpdate, acao, deCat, paraCat, diff) {
    if (!pcmEditavel) {
      return alert("PCM fechado: não é permitido editar/mover veículos após 10:00 do dia seguinte.");
    }

    const v = editVeiculo;
    if (!v?.id) return;

    if (payloadUpdate.frota && payloadUpdate.frota !== v.frota) {
      const { data: dup, error: errDup } = await supabase
        .from("veiculos_pcm")
        .select("id")
        .eq("pcm_id", id)
        .eq("frota", payloadUpdate.frota)
        .is("data_saida", null)
        .limit(1);

      if (errDup) {
        console.error(errDup);
        return alert("Erro ao validar duplicidade de frota.");
      }

      if (dup && dup.length > 0) {
        return alert(`A frota ${payloadUpdate.frota} já existe neste PCM (em aberto).`);
      }
    }

    const { error } = await supabase.from("veiculos_pcm").update(payloadUpdate).eq("id", v.id);

    if (error) {
      console.error(error);
      alert("Erro ao salvar alterações.");
      return;
    }

    await gravarHistorico({
      veiculo_pcm_id: v.id,
      pcm_id: id,
      frota: payloadUpdate.frota || v.frota,
      acao,
      de_categoria: deCat,
      para_categoria: paraCat,
      alteracoes: diff,
    });

    buscarDados();
  }

  // ✅ clusters disponíveis (para chips)
  const clustersDisponiveis = useMemo(() => {
    const s = new Set();
    (prefixos || []).forEach((p) => {
      const cl = String(p?.cluster || "").trim();
      if (cl) s.add(cl);
    });
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [prefixos]);

  // ============================
  // FILTRO + ORDENAÇÃO
  // ============================
  const veiculosFiltrados = useMemo(() => {
    const txt = filtroTexto.trim().toLowerCase();

    // ✅ ORDEM: GNS → FAIXA_AMARELA → NOITE → PENDENTES → VENDA
    const orderCat = { GNS: 0, FAIXA_AMARELA: 1, NOITE: 2, PENDENTES: 3, VENDA: 4 };

    const setCats = new Set(filtroCategorias || []);
    const setSetores = new Set(filtroSetores || []);
    const setTurnos = new Set(filtroTurnos || []);
    const setClusters = new Set(filtroCluster || []);

    return (veiculos || [])
      .filter((v) => {
        if (abaAtiva !== "TODOS" && v.categoria !== abaAtiva) return false;

        if (setCats.size && !setCats.has(v.categoria)) return false;
        if (setSetores.size && !setSetores.has(v.setor)) return false;
        if (setTurnos.size && !setTurnos.has(v.lancado_no_turno)) return false;
        if (setClusters.size && !setClusters.has(String(v.cluster || ""))) return false;

        if (!txt) return true;

        const s = [v.frota, v.descricao, v.ordem_servico, v.setor, v.lancado_por, v.observacao, v.cluster]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return s.includes(txt);
      })
      .sort((a, b) => {
        const ca = orderCat[a.categoria] ?? 99;
        const cb = orderCat[b.categoria] ?? 99;
        if (ca !== cb) return ca - cb;

        const da = daysBetween(a.data_entrada);
        const db = daysBetween(b.data_entrada);
        if (da !== db) return db - da;

        const ta = new Date(a.data_entrada || 0).getTime();
        const tb = new Date(b.data_entrada || 0).getTime();
        return ta - tb;
      });
  }, [veiculos, filtroTexto, filtroCategorias, filtroSetores, filtroTurnos, filtroCluster, abaAtiva]);

  const resumo = useMemo(() => {
    const base = veiculosFiltrados.length ? veiculosFiltrados : veiculos;
    const total = (base || []).length;

    const byCat = { GNS: 0, FAIXA_AMARELA: 0, NOITE: 0, VENDA: 0, PENDENTES: 0 };
    (base || []).forEach((v) => {
      if (byCat[v.categoria] !== undefined) byCat[v.categoria]++;
    });

    return { total, ...byCat };
  }, [veiculos, veiculosFiltrados]);

  // ✅ PDF PROFISSIONAL (sem print, mantendo cores, com paginação)
  async function baixarPdfPCM() {
    try {
      if (!reportRef.current) return;

      await new Promise((r) => requestAnimationFrame(r));

      const scale = 3;
      const canvas = await html2canvas(reportRef.current, {
        scale,
        backgroundColor: "#ffffff",
        useCORS: true,
        allowTaint: true,
        logging: false,
        windowWidth: reportRef.current.scrollWidth,
        windowHeight: reportRef.current.scrollHeight,
      });

      const fileName = `PCM_${pcmInfo?.data_referencia || "diario"}.pdf`;

      // A4 landscape (mm)
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 6;

      const printableW = pageW - margin * 2;
      const printableH = pageH - margin * 2;

      const mmPerPx = printableW / canvas.width;
      const pageSlicePx = Math.floor(printableH / mmPerPx);

      let y = 0;
      let pageIndex = 0;

      while (y < canvas.height) {
        const sliceH = Math.min(pageSlicePx, canvas.height - y);

        const pageCanvas = document.createElement("canvas");
        pageCanvas.width = canvas.width;
        pageCanvas.height = sliceH;

        const ctx = pageCanvas.getContext("2d");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
        ctx.drawImage(canvas, 0, y, canvas.width, sliceH, 0, 0, canvas.width, sliceH);

        const imgData = pageCanvas.toDataURL("image/png", 1.0);

        if (pageIndex > 0) doc.addPage();

        const renderW = printableW;
        const renderH = sliceH * mmPerPx;

        doc.addImage(imgData, "PNG", margin, margin, renderW, renderH, undefined, "FAST");

        y += sliceH;
        pageIndex += 1;
      }

      doc.save(fileName);
    } catch (err) {
      console.error(err);
      alert("Erro ao gerar PDF do PCM.");
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      {/* CABEÇALHO */}
      <div className="bg-white p-5 rounded-xl shadow-sm flex flex-col md:flex-row justify-between md:items-center gap-4 border-b-4 border-blue-600">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate("/pcm-inicio")} className="p-2 hover:bg-gray-100 rounded-full" title="Voltar">
            <FaArrowLeft />
          </button>

          <div>
            <h1 className="text-xl md:text-2xl font-black uppercase tracking-tight">PCM - Planejamento e Controle de Manutenção</h1>
            <p className="text-xs text-gray-500 font-semibold">
              Referência: <span className="font-black">{pcmInfo?.data_referencia || "-"}</span>
              {!pcmEditavel ? (
                <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full bg-gray-200 text-gray-700 text-[10px] font-black">
                  SOMENTE CONSULTA (fechado)
                </span>
              ) : (
                <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full bg-green-100 text-green-700 text-[10px] font-black">
                  EDITÁVEL (até 10:00 do dia seguinte)
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
          <div className="flex bg-gray-100 rounded-lg overflow-hidden border">
            <button
              className={`px-4 py-2 text-xs font-black ${turnoAtivo === "DIA" ? "bg-blue-700 text-white" : "text-gray-700"}`}
              onClick={() => setTurnoAtivo("DIA")}
            >
              TURNO DIA
            </button>
            <button
              className={`px-4 py-2 text-xs font-black ${turnoAtivo === "NOITE" ? "bg-blue-700 text-white" : "text-gray-700"}`}
              onClick={() => setTurnoAtivo("NOITE")}
            >
              TURNO NOITE
            </button>
          </div>

          <button
            onClick={baixarPdfPCM}
            className="bg-blue-700 text-white px-5 py-2 rounded-lg font-black flex items-center justify-center gap-2 hover:bg-blue-800 transition-all"
          >
            <FaDownload /> BAIXAR PCM (PDF)
          </button>
        </div>
      </div>

      {/* RESUMO */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mt-4">
        <div className="bg-white rounded-xl shadow p-4 border">
          <p className="text-[10px] font-black text-gray-500 uppercase">Total</p>
          <p className="text-2xl font-black mt-1">{resumo.total}</p>
        </div>

        <div className="bg-white rounded-xl shadow p-4 border">
          <p className="text-[10px] font-black text-gray-500 uppercase">GNS</p>
          <p className="text-2xl font-black mt-1 text-red-600">{resumo.GNS}</p>
        </div>

        <div className="bg-white rounded-xl shadow p-4 border">
          <p className="text-[10px] font-black text-gray-500 uppercase">Faixa Amarela</p>
          <p className="text-2xl font-black mt-1 text-yellow-600">{resumo.FAIXA_AMARELA}</p>
        </div>

        <div className="bg-white rounded-xl shadow p-4 border">
          <p className="text-[10px] font-black text-gray-500 uppercase">Noturno</p>
          <p className="text-2xl font-black mt-1">{resumo.NOITE}</p>
        </div>

        <div className="bg-white rounded-xl shadow p-4 border">
          <p className="text-[10px] font-black text-gray-500 uppercase">Pendentes</p>
          <p className="text-2xl font-black mt-1 text-gray-600">{resumo.PENDENTES}</p>
        </div>

        <div className="bg-white rounded-xl shadow p-4 border">
          <p className="text-[10px] font-black text-gray-500 uppercase">Venda</p>
          <p className="text-2xl font-black mt-1 text-blue-700">{resumo.VENDA}</p>
        </div>
      </div>

      {/* FORMULÁRIO */}
      <div className="bg-gray-900 p-5 mt-4 rounded-xl shadow-inner text-white">
        <div className="grid grid-cols-1 md:grid-cols-7 gap-3 items-end">
          <div className="flex flex-col">
            <label className="text-[10px] font-bold mb-1">FROTA</label>
            <select
              className="p-2 rounded text-black text-sm font-bold"
              value={form.frota}
              onChange={(e) => setForm({ ...form, frota: e.target.value })}
              disabled={!pcmEditavel}
            >
              <option value="">Selecione...</option>
              {prefixos.map((p) => (
                <option key={p.codigo} value={p.codigo}>
                  {p.codigo}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col">
            <label className="text-[10px] font-bold mb-1">CATEGORIA</label>
            <select
              className="p-2 rounded text-black text-sm font-bold"
              value={form.categoria}
              onChange={(e) => setForm({ ...form, categoria: e.target.value })}
              disabled={!pcmEditavel}
            >
              <option value="GNS">GNS (Vermelho)</option>
              <option value="FAIXA_AMARELA">Faixa Amarela (Amarelo)</option>
              <option value="NOITE">Liberação Noturno (Branco)</option>
              <option value="PENDENTES">Pendentes (Cinza)</option>
              <option value="VENDA">Venda (Azul)</option>
            </select>
          </div>

          <div className="flex flex-col">
            <label className="text-[10px] font-bold mb-1">SETOR</label>
            <select
              className="p-2 rounded text-black text-sm font-bold"
              value={form.setor}
              onChange={(e) => setForm({ ...form, setor: e.target.value })}
              disabled={!pcmEditavel}
            >
              {SETORES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col">
            <label className="text-[10px] font-bold mb-1">ORDEM SERVIÇO (OBRIGATÓRIO)</label>
            <input
              className="p-2 rounded text-black text-sm"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={form.ordem_servico}
              onChange={(e) => setForm({ ...form, ordem_servico: e.target.value.replace(/\D/g, "") })}
              placeholder="Somente números"
              required
              disabled={!pcmEditavel}
            />
          </div>

          <div className="flex flex-col md:col-span-2">
            <label className="text-[10px] font-bold mb-1">DESCRIÇÃO DO DEFEITO</label>
            <input
              className="p-2 rounded text-black text-sm"
              type="text"
              value={form.descricao}
              onChange={(e) => setForm({ ...form, descricao: e.target.value })}
              placeholder="Defeito relatado..."
              disabled={!pcmEditavel}
            />
          </div>

          <button
            onClick={lancarVeiculo}
            disabled={!pcmEditavel}
            className={`p-2 rounded font-black flex items-center justify-center gap-2 h-[40px] ${
              !pcmEditavel ? "bg-gray-600 text-white opacity-60 cursor-not-allowed" : "bg-green-600 hover:bg-green-500 text-white"
            }`}
            title={!pcmEditavel ? "PCM fechado" : "Lançar"}
          >
            <FaTruckLoading size={18} /> LANÇAR
          </button>
        </div>

        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="flex flex-col">
            <label className="text-[10px] font-bold mb-1">OBSERVAÇÃO (OBRIGATÓRIA)</label>
            <select
              className="p-2 rounded text-black text-sm font-bold"
              value={form.observacao}
              onChange={(e) => setForm({ ...form, observacao: e.target.value })}
              disabled={!pcmEditavel}
            >
              <option value="">Selecione...</option>
              {OBS_OPCOES.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end gap-2">
            <span className="text-[10px] font-black text-gray-300 uppercase">Lançado no turno:</span>
            <span className="px-3 py-1 rounded-full bg-blue-700 text-white text-xs font-black">{turnoAtivo}</span>
          </div>
        </div>
      </div>

      {/* FILTROS */}
      <div className="bg-white rounded-xl shadow p-4 mt-4 border">
        <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <FaSearch className="text-gray-500" />
            <input
              className="w-full md:w-[380px] border rounded-lg px-3 py-2 text-sm font-semibold"
              value={filtroTexto}
              onChange={(e) => setFiltroTexto(e.target.value)}
              placeholder="Buscar frota, OS, descrição, setor, responsável..."
            />
          </div>

          <div className="flex flex-col gap-2 items-start md:items-end">
            <div className="flex items-center gap-2 text-xs font-black text-gray-500">
              <FaFilter /> Filtros (multi):
            </div>

            <div className="flex flex-wrap gap-2 items-center">
              <MultiSelectChips
                label="Cluster"
                options={clustersDisponiveis.map((cl) => ({ value: cl, label: cl }))}
                values={filtroCluster}
                onChange={setFiltroCluster}
              />

              <MultiSelectChips
                label="Categoria"
                options={CATEGORIAS.map((c) => ({ value: c.value, label: c.label }))}
                values={filtroCategorias}
                onChange={setFiltroCategorias}
              />

              <MultiSelectChips
                label="Setor"
                options={SETORES.map((s) => ({ value: s, label: s }))}
                values={filtroSetores}
                onChange={setFiltroSetores}
              />

              <MultiSelectChips
                label="Turno"
                options={[
                  { value: "DIA", label: "DIA" },
                  { value: "NOITE", label: "NOITE" },
                ]}
                values={filtroTurnos}
                onChange={setFiltroTurnos}
              />

              <button
                className="px-3 py-2 text-xs font-black rounded-lg bg-gray-100 hover:bg-gray-200"
                onClick={() => {
                  setFiltroTexto("");
                  setFiltroCluster([]);
                  setFiltroCategorias([]);
                  setFiltroSetores([]);
                  setFiltroTurnos([]);
                  setAbaAtiva("TODOS");
                }}
              >
                Limpar tudo
              </button>
            </div>
          </div>
        </div>

        {/* ABAS */}
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            className={`px-4 py-2 rounded-lg text-xs font-black border ${
              abaAtiva === "TODOS" ? "bg-gray-900 text-white" : "bg-white text-gray-800"
            }`}
            onClick={() => setAbaAtiva("TODOS")}
          >
            TODOS
          </button>

          {CATEGORIAS.map((c) => (
            <button
              key={c.value}
              className={`px-4 py-2 rounded-lg text-xs font-black border ${
                abaAtiva === c.value ? "bg-gray-900 text-white" : "bg-white text-gray-800"
              }`}
              onClick={() => setAbaAtiva(c.value)}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* BLOCO EXCLUSIVO DO PDF */}
      <div className="fixed -left-[99999px] top-0 pointer-events-none opacity-0">
        <div ref={reportRef} className="bg-white w-[1400px] p-6 text-black">
          {/* TOPO PDF */}
          <div className="mb-5">
            <div className="bg-blue-700 text-white rounded-t-xl px-5 py-4">
              <div className="text-2xl font-black uppercase tracking-tight">PCM - Planejamento e Controle de Manutenção</div>
              <div className="text-sm font-semibold mt-1">
                Referência: <span className="font-black">{pcmInfo?.data_referencia || "-"}</span>
              </div>
            </div>

            <div className="border border-t-0 rounded-b-xl px-5 py-4 bg-white">
              <div className="flex flex-wrap gap-6 text-sm font-semibold text-gray-700">
                <div>
                  Itens em aberto: <span className="font-black text-gray-900">{veiculosFiltrados.length}</span>
                </div>
                <div>
                  Status:{" "}
                  <span className={`font-black ${pcmEditavel ? "text-green-700" : "text-gray-700"}`}>
                    {pcmEditavel ? "EDITÁVEL (até 10:00 do dia seguinte)" : "SOMENTE CONSULTA (fechado)"}
                  </span>
                </div>
                <div>
                  Gerado em: <span className="font-black text-gray-900">{new Date().toLocaleString("pt-BR")}</span>
                </div>
              </div>
            </div>
          </div>

          {/* RESUMO NO COMEÇO DO PDF */}
          <div className="grid grid-cols-6 gap-3 mb-6">
            <div className="rounded-xl border bg-white p-4 shadow-sm">
              <p className="text-[10px] font-black text-gray-500 uppercase">Total</p>
              <p className="text-2xl font-black mt-1">{resumo.total}</p>
            </div>

            <div className="rounded-xl border bg-white p-4 shadow-sm">
              <p className="text-[10px] font-black text-gray-500 uppercase">GNS</p>
              <p className="text-2xl font-black mt-1 text-red-600">{resumo.GNS}</p>
            </div>

            <div className="rounded-xl border bg-white p-4 shadow-sm">
              <p className="text-[10px] font-black text-gray-500 uppercase">Faixa Amarela</p>
              <p className="text-2xl font-black mt-1 text-yellow-600">{resumo.FAIXA_AMARELA}</p>
            </div>

            <div className="rounded-xl border bg-white p-4 shadow-sm">
              <p className="text-[10px] font-black text-gray-500 uppercase">Noturno</p>
              <p className="text-2xl font-black mt-1">{resumo.NOITE}</p>
            </div>

            <div className="rounded-xl border bg-white p-4 shadow-sm">
              <p className="text-[10px] font-black text-gray-500 uppercase">Pendentes</p>
              <p className="text-2xl font-black mt-1 text-gray-600">{resumo.PENDENTES}</p>
            </div>

            <div className="rounded-xl border bg-white p-4 shadow-sm">
              <p className="text-[10px] font-black text-gray-500 uppercase">Venda</p>
              <p className="text-2xl font-black mt-1 text-blue-700">{resumo.VENDA}</p>
            </div>
          </div>

          {/* CABEÇALHO DA TABELA PDF */}
          <div className="mb-3">
            <h2 className="text-base font-black uppercase text-gray-800">Relatório diário - PCM</h2>
            <p className="text-xs text-gray-500 font-semibold">
              Ordenação: Categoria (GNS → Amarela → Branco → Cinza → Venda) e Tempo parado (desc)
            </p>
          </div>

          {/* TABELA PDF */}
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-gray-100 text-[10px] uppercase text-gray-600 border font-black">
                <th className="p-3 border whitespace-nowrap">Cluster</th>
                <th className="p-3 border whitespace-nowrap">Frota</th>
                <th className="p-3 border whitespace-nowrap">Entrada</th>
                <th className="p-3 border text-center whitespace-nowrap">Dias</th>
                <th className="p-3 border whitespace-nowrap">Categoria</th>
                <th className="p-3 border w-[420px]">Descrição</th>
                <th className="p-3 border whitespace-nowrap">O.S</th>
                <th className="p-3 border whitespace-nowrap">Setor</th>
                <th className="p-3 border whitespace-nowrap">Turno</th>
                <th className="p-3 border whitespace-nowrap">Responsável</th>
                <th className="p-3 border w-[260px]">Observação</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={11} className="p-6 text-center text-gray-500 font-bold border">
                    Carregando PCM...
                  </td>
                </tr>
              ) : veiculosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={11} className="p-6 text-center text-gray-500 font-bold border">
                    Nenhum registro encontrado.
                  </td>
                </tr>
              ) : (
                veiculosFiltrados.map((v) => {
                  const catStyle = getCategoriaStyle(v.categoria);
                  const dias = daysBetween(v.data_entrada);

                  return (
                    <tr key={v.id} className={`border-b border-gray-200 font-medium ${catStyle.color}`}>
                      <td className="p-3 border border-black/10 text-[10px] font-black uppercase">{v.cluster || "-"}</td>
                      <td className="p-3 text-lg font-black border border-black/10">{v.frota}</td>
                      <td className="p-3 border border-black/10">{formatBRDate(v.data_entrada)}</td>
                      <td className="p-3 text-center font-black border border-black/10 text-lg">{dias}</td>
                      <td className="p-3 border border-black/10">
                        <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase ${catStyle.badge}`}>
                          {catStyle.label}
                        </span>
                      </td>
                      <td className="p-3 text-[11px] uppercase leading-tight border border-black/10">{v.descricao}</td>
                      <td className="p-3 font-bold border border-black/10">{v.ordem_servico || "-"}</td>
                      <td className="p-3 text-[10px] font-black border border-black/10">{v.setor}</td>
                      <td className="p-3 border border-black/10">
                        <span className="px-2 py-1 rounded-full bg-black/20 text-[10px] font-black uppercase">
                          {v.lancado_no_turno || "-"}
                        </span>
                      </td>
                      <td className="p-3 text-[10px] italic border border-black/10">{v.lancado_por || "-"}</td>
                      <td className="p-3 text-[10px] font-bold border border-black/10 uppercase">{v.observacao || "-"}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>

          <div className="mt-4 pt-3 border-t text-[10px] text-gray-500 font-bold flex justify-between">
            <span>PCM Diário — Quatai</span>
            <span>Gerado em: {new Date().toLocaleString("pt-BR")}</span>
          </div>
        </div>
      </div>

      {/* RELATORIO VISUAL DA TELA */}
      <div className="bg-white shadow-2xl overflow-hidden rounded-xl border mt-4">
        <div className="p-4 border-b bg-gray-50">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-2">
            <div>
              <h2 className="text-sm md:text-base font-black uppercase text-gray-800">Relatório diário - PCM</h2>
              <p className="text-xs text-gray-500 font-semibold">
                Data: <span className="font-black">{pcmInfo?.data_referencia || "-"}</span> | Itens em aberto:{" "}
                <span className="font-black">{veiculosFiltrados.length}</span>
              </p>
            </div>

            <div className="text-[10px] font-black text-gray-500 uppercase">
              Ordenação: Categoria (GNS → Amarela → Branco → Cinza → Venda) e Tempo parado (desc)
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-gray-100 text-[10px] uppercase text-gray-600 border-b font-black">
                <th className="p-3 border-r whitespace-nowrap">Cluster</th>
                <th className="p-3 border-r whitespace-nowrap">Frota</th>
                <th className="p-3 border-r whitespace-nowrap">Entrada</th>
                <th className="p-3 border-r text-center whitespace-nowrap">Dias</th>
                <th className="p-3 border-r whitespace-nowrap">Categoria</th>
                <th className="p-3 border-r w-[420px]">Descrição</th>
                <th className="p-3 border-r whitespace-nowrap">O.S</th>
                <th className="p-3 border-r whitespace-nowrap">Setor</th>
                <th className="p-3 border-r whitespace-nowrap">Turno</th>
                <th className="p-3 border-r whitespace-nowrap">Responsável</th>
                <th className="p-3 border-r w-[260px]">Observação</th>
                <th className="p-3 text-center whitespace-nowrap">Ações</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={12} className="p-6 text-center text-gray-500 font-bold">
                    Carregando PCM...
                  </td>
                </tr>
              ) : veiculosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={12} className="p-6 text-center text-gray-500 font-bold">
                    Nenhum registro encontrado.
                  </td>
                </tr>
              ) : (
                veiculosFiltrados.map((v) => {
                  const catStyle = getCategoriaStyle(v.categoria);
                  const dias = daysBetween(v.data_entrada);

                  return (
                    <tr key={v.id} className={`border-b border-gray-200 font-medium ${catStyle.color}`}>
                      <td className="p-3 border-r border-black/10 text-[10px] font-black uppercase">{v.cluster || "-"}</td>
                      <td className="p-3 text-lg font-black border-r border-black/10">{v.frota}</td>
                      <td className="p-3 border-r border-black/10">{formatBRDate(v.data_entrada)}</td>
                      <td className="p-3 text-center font-black border-r border-black/10 text-lg">{dias}</td>
                      <td className="p-3 border-r border-black/10">
                        <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase ${catStyle.badge}`}>
                          {catStyle.label}
                        </span>
                      </td>
                      <td className="p-3 text-[11px] uppercase leading-tight border-r border-black/10">{v.descricao}</td>
                      <td className="p-3 font-bold border-r border-black/10">{v.ordem_servico || "-"}</td>
                      <td className="p-3 text-[10px] font-black border-r border-black/10">{v.setor}</td>
                      <td className="p-3 border-r border-black/10">
                        <span className="px-2 py-1 rounded-full bg-black/20 text-[10px] font-black uppercase">
                          {v.lancado_no_turno || "-"}
                        </span>
                      </td>
                      <td className="p-3 text-[10px] italic border-r border-black/10">{v.lancado_por || "-"}</td>
                      <td className="p-3 text-[10px] font-bold border-r border-black/10 uppercase">{v.observacao || "-"}</td>

                      <td className="p-3 text-center">
                        <div className="flex justify-center gap-2">
                          <button
                            onClick={() => liberarVeiculo(v)}
                            disabled={!pcmEditavel}
                            className={`p-2 rounded-full shadow-lg transition-transform ${
                              !pcmEditavel
                                ? "bg-gray-400 text-white opacity-60 cursor-not-allowed"
                                : "bg-green-500 hover:bg-green-400 text-white hover:scale-110"
                            }`}
                            title={!pcmEditavel ? "PCM fechado" : "Liberar veículo"}
                          >
                            <FaCheckCircle size={16} />
                          </button>

                          <button
                            onClick={() => {
                              if (!pcmEditavel)
                                return alert("PCM fechado: não é permitido editar/mover após 10:00 do dia seguinte.");
                              setEditVeiculo(v);
                              setEditOpen(true);
                            }}
                            disabled={!pcmEditavel}
                            className={`p-2 rounded-full shadow-lg transition-transform ${
                              !pcmEditavel
                                ? "bg-gray-400 text-white opacity-60 cursor-not-allowed"
                                : "bg-black/20 hover:bg-black/30 text-white hover:scale-110"
                            }`}
                            title={!pcmEditavel ? "PCM fechado" : "Editar / Mover"}
                          >
                            <FaEdit size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="p-3 border-t bg-gray-50 text-[10px] text-gray-500 font-bold flex justify-between">
          <span>PCM Diário — Quatai</span>
          <span>Gerado em: {new Date().toLocaleString("pt-BR")}</span>
        </div>
      </div>

      {/* MODAL EDITAR */}
      <EditarVeiculoModal
        open={editOpen}
        veiculo={editVeiculo}
        prefixos={prefixos}
        onClose={() => {
          setEditOpen(false);
          setEditVeiculo(null);
        }}
        onSalvar={salvarEdicaoVeiculo}
      />
    </div>
  );
}
