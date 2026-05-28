import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import PullToRefresh from "../../components/PullToRefresh";
import {
  FaBarcode,
  FaCamera,
  FaCheck,
  FaChevronRight,
  FaDownload,
  FaRedo,
  FaRobot,
  FaSearch,
  FaTimes,
} from "react-icons/fa";
import { AuthContext } from "../../context/AuthContext";
import { supabase } from "../../supabase";
import {
  ActionButton,
  EmptyState,
  KpiCard,
  PageHero,
  Panel,
  StatusChip,
} from "./SuprimentosUI";
import { formatDateBR, formatDateTimeBR } from "./suprimentosShared";

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-800 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100";

function Field({ label, required = false, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
        {required ? <span className="ml-1 text-rose-500">*</span> : null}
      </span>
      {children}
    </label>
  );
}

function diffTone(diff) {
  if (diff === null || diff === undefined) return "slate";
  if (Number(diff) === 0) return "emerald";
  return Number(diff) > 0 ? "amber" : "rose";
}

/* ─── Scanner ─────────────────────────────────────────────── */
function BarcodeScanner({ open, onClose, onScan }) {
  const videoRef = useRef(null);
  const controlsRef = useRef(null);
  const streamRef = useRef(null);
  const detectorFrameRef = useRef(null);
  const scanTimerRef = useRef(null);
  const scanBoxRef = useRef(null);
  const scannedRef = useRef(false);
  const [error, setError] = useState("");

  function stopScanner() {
    if (detectorFrameRef.current) {
      cancelAnimationFrame(detectorFrameRef.current);
      detectorFrameRef.current = null;
    }
    if (scanTimerRef.current) {
      clearTimeout(scanTimerRef.current);
      scanTimerRef.current = null;
    }
    try { controlsRef.current?.stop?.(); } catch {}
    try { streamRef.current?.getTracks?.().forEach((track) => track.stop()); } catch {}
    controlsRef.current = null;
    streamRef.current = null;
  }

  function finishScan(text) {
    const value = String(text || "").trim();
    if (!value || scannedRef.current) return;
    scannedRef.current = true;
    stopScanner();
    onScan(value);
  }

  async function tuneCamera() {
    const stream = videoRef.current?.srcObject || streamRef.current;
    const track = stream?.getVideoTracks?.()[0];
    if (!track?.getCapabilities || !track?.applyConstraints) return;

    const caps = track.getCapabilities();
    const advanced = [];
    if (Array.isArray(caps.focusMode) && caps.focusMode.includes("continuous")) {
      advanced.push({ focusMode: "continuous" });
    }
    if (Array.isArray(caps.exposureMode) && caps.exposureMode.includes("continuous")) {
      advanced.push({ exposureMode: "continuous" });
    }
    if (caps.zoom) {
      const minZoom = Number(caps.zoom.min || 1);
      const maxZoom = Number(caps.zoom.max || 1);
      const zoom = Math.min(maxZoom, Math.max(minZoom, 1.6));
      advanced.push({ zoom });
    }
    if (!advanced.length) return;

    try { await track.applyConstraints({ advanced }); } catch {}
  }

  function drawScanArea(video, canvas) {
    const box = scanBoxRef.current;
    if (!box || !video?.videoWidth || !video?.videoHeight) return false;

    const videoRect = video.getBoundingClientRect();
    const boxRect = box.getBoundingClientRect();
    const scale = Math.max(videoRect.width / video.videoWidth, videoRect.height / video.videoHeight);
    const renderedWidth = video.videoWidth * scale;
    const renderedHeight = video.videoHeight * scale;
    const offsetX = (videoRect.width - renderedWidth) / 2;
    const offsetY = (videoRect.height - renderedHeight) / 2;

    const sourceX = (boxRect.left - videoRect.left - offsetX) / scale;
    const sourceY = (boxRect.top - videoRect.top - offsetY) / scale;
    const sourceW = boxRect.width / scale;
    const sourceH = boxRect.height / scale;
    const sx = Math.max(0, Math.min(video.videoWidth - 1, sourceX));
    const sy = Math.max(0, Math.min(video.videoHeight - 1, sourceY));
    const sw = Math.max(1, Math.min(video.videoWidth - sx, sourceW));
    const sh = Math.max(1, Math.min(video.videoHeight - sy, sourceH));

    canvas.width = Math.max(360, Math.round(sw));
    canvas.height = Math.max(360, Math.round(sh));
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return false;
    ctx.filter = "contrast(1.18) brightness(1.08) saturate(1.05)";
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    return true;
  }

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setError("");
    scannedRef.current = false;

    (async () => {
      try {
        const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
          import("@zxing/browser"),
          import("@zxing/library"),
        ]);
        const hints = new Map();
        hints.set(DecodeHintType.TRY_HARDER, true);
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [
          BarcodeFormat.CODE_128,
          BarcodeFormat.CODE_39,
          BarcodeFormat.EAN_13,
          BarcodeFormat.EAN_8,
          BarcodeFormat.UPC_A,
          BarcodeFormat.UPC_E,
          BarcodeFormat.ITF,
          BarcodeFormat.CODABAR,
        ]);
        const reader = new BrowserMultiFormatReader(hints, {
          delayBetweenScanAttempts: 70,
          delayBetweenScanSuccess: 250,
          tryPlayVideoTimeout: 5000,
        });
        if (cancelled) return;

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            frameRate: { ideal: 30, max: 60 },
          },
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        await tuneCamera();

        const canvas = document.createElement("canvas");
        let nativeDetector = null;
        if ("BarcodeDetector" in window) {
          try {
            nativeDetector = new window.BarcodeDetector({
              formats: ["code_128", "code_39", "ean_13", "ean_8", "upc_a", "upc_e", "itf", "codabar"],
            });
          } catch {}
        }

        const scanFrame = async () => {
          if (cancelled || scannedRef.current) return;
          const video = videoRef.current;
          if (video?.readyState >= 2 && drawScanArea(video, canvas)) {
            try {
              const codes = nativeDetector ? await nativeDetector.detect(canvas) : [];
              const rawValue = codes?.[0]?.rawValue;
              if (rawValue) {
                finishScan(rawValue);
                return;
              }
            } catch {}

            try {
              const result = reader.decodeFromCanvas(canvas);
              if (result) {
                finishScan(result.getText());
                return;
              }
            } catch {}
          }

          scanTimerRef.current = setTimeout(scanFrame, 90);
        };

        scanFrame();
      } catch (err) {
        setError(err?.message || "Nao consegui acessar a camera.");
      }
    })();

    return () => {
      cancelled = true;
      stopScanner();
    };
  }, [open, onScan]);
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120] flex flex-col bg-slate-950/90">
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-4 text-white">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wider text-blue-300">Contagem</p>
          <h2 className="text-lg font-semibold">Apontar para o código de barras</h2>
        </div>
        <button
          onClick={() => { stopScanner(); onClose(); }}
          className="rounded-xl border border-white/20 px-3 py-2 text-sm font-semibold text-white hover:bg-white/10"
        >
          <FaTimes className="inline" /> Fechar
        </button>
      </div>
      <div className="relative flex flex-1 items-center justify-center overflow-hidden">
        <video
          ref={videoRef}
          className="h-full w-full object-cover [filter:contrast(1.18)_brightness(1.08)_saturate(1.05)]"
          muted
          playsInline
        />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div
            ref={scanBoxRef}
            className="relative h-[72vw] w-[72vw] max-h-80 max-w-80 rounded-[28px] border-[3px] border-blue-300/90 shadow-[0_0_0_9999px_rgba(2,6,23,0.52)]"
          >
            <div className="absolute left-8 right-8 top-1/2 h-0.5 rounded-full bg-blue-200/95 shadow-[0_0_18px_rgba(147,197,253,0.95)]" />
          </div>
        </div>
        <div className="pointer-events-none absolute inset-x-5 bottom-6 rounded-2xl bg-slate-950/80 px-4 py-3 text-center text-sm font-semibold text-white">
          Mantenha o codigo inteiro dentro da moldura.
        </div>
        {error ? (
          <div className="absolute inset-x-4 bottom-24 rounded-xl bg-rose-500/90 px-4 py-3 text-sm font-semibold text-white">
            {error}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* ─── Página ──────────────────────────────────────────────── */
export default function SuprimentosContagem() {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const isNativeShell = Capacitor.isNativePlatform();
  const userInfo = useMemo(() => ({
    id: Number(user?.usuario_id || user?.id || 0) || null,
    login: user?.login || user?.email || null,
    nome: user?.nome || user?.nome_completo || user?.login || user?.email || "Usuario",
  }), [user]);

  // ─── Form de novo apontamento ──────────────────────────────
  const [codigo, setCodigo] = useState("");
  const [peca, setPeca] = useState(null);
  const [naoCadastrado, setNaoCadastrado] = useState(false);
  const [quantidade, setQuantidade] = useState("");
  const [observacao, setObservacao] = useState("");
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [fluxoAtivo, setFluxoAtivo] = useState(false);
  const [itensSessao, setItensSessao] = useState(0);
  const [loteId, setLoteId] = useState(null);

  function novoLoteId() {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
    // fallback simples
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
  const [mobileCentralOpen, setMobileCentralOpen] = useState(false);

  const codigoInputRef = useRef(null);
  const qtdInputRef = useRef(null);

  function montarCodigosBusca(valor) {
    const raw = String(valor || "").trim();
    const digits = raw.replace(/\D/g, "");
    const codigos = new Set([raw]);
    if (digits && digits === raw) {
      const semZeros = digits.replace(/^0+/, "") || "0";
      codigos.add(semZeros);
      [8, 9, 10, 11, 12, 13, 14].forEach((size) => codigos.add(semZeros.padStart(size, "0")));
    }
    return [...codigos].filter(Boolean);
  }

  async function buscarPeca(codigoBusca) {
    const c = String(codigoBusca || "").trim();
    if (!c) { setPeca(null); setNaoCadastrado(false); return; }
    setBusy(true); setErro(""); setAviso("");
    const candidatos = montarCodigosBusca(c);
    const filtroCodigos = candidatos
      .flatMap((codigoItem) => [`codigo.eq.${codigoItem}`, `ref_fabricante.eq.${codigoItem}`])
      .join(",");
    const { data, error } = await supabase
      .from("suprimentos_pecas")
      .select("id, codigo, descricao, unidade_padrao, localizacao, estoque_min, estoque_max, saldo_erp")
      .or(filtroCodigos)
      .limit(1)
      .maybeSingle();
    setBusy(false);
    if (error) { setErro(error.message); setPeca(null); setNaoCadastrado(false); return; }
    if (!data) {
      setPeca(null);
      setNaoCadastrado(true);
      setAviso(`Código ${c} não está na base. Pode contar mesmo assim — vai aparecer como pendente.`);
      setTimeout(() => qtdInputRef.current?.focus(), 50);
      return;
    }
    if (data.codigo && data.codigo !== c) setCodigo(data.codigo);
    setPeca(data);
    setNaoCadastrado(false);
    setTimeout(() => qtdInputRef.current?.focus(), 50);
  }

  function limparApontamento() {
    setCodigo("");
    setPeca(null);
    setNaoCadastrado(false);
    setQuantidade("");
    setObservacao("");
    setErro("");
    setAviso("");
  }

  function todayIsoBRT() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  }

  async function dispararDispatchSilencioso(tipo, dataAlvo, loteIdParam) {
    try {
      // 1) Debounce — se já existe job pro mesmo lote, nem cria nem chama
      if (loteIdParam) {
        const { data: jaTem } = await supabase
          .from("suprimentos_bot_jobs")
          .select("id,status")
          .eq("lote_id", loteIdParam)
          .limit(1);
        if (jaTem && jaTem.length > 0) return;
      } else if (dataAlvo) {
        const { data: jaTem } = await supabase
          .from("suprimentos_bot_jobs")
          .select("id,status")
          .eq("data_alvo", dataAlvo)
          .eq("tipo_contagem", tipo)
          .in("status", ["pendente", "processando"])
          .limit(1);
        if (jaTem && jaTem.length > 0) return;
      }

      // 2) Insere o job (rede de segurança — o cron de 5 min pega mesmo sem GitHub)
      await supabase.from("suprimentos_bot_jobs").insert({
        tipo: "conferencia_dia",
        tipo_contagem: tipo,
        data_alvo: dataAlvo,
        status: "pendente",
        lote_id: loteIdParam || null,
        criado_por_nome: userInfo.nome || "App",
      });

      // 3) Chama o GitHub Actions agora (workflow_dispatch)
      const token = import.meta.env.VITE_GITHUB_TOKEN_BOT;
      if (!token) return; // sem token, fica só o cron
      const owner = import.meta.env.VITE_GITHUB_USER_BOT || "guuimaximo";
      const repo = import.meta.env.VITE_GITHUB_REPO_BOT || "INOVE_QUATAI";
      const ref = import.meta.env.VITE_GITHUB_REF_BOT || "main";
      const workflow = tipo === "semanal" ? "bot-estoque-semanal.yml" : "bot-estoque-diaria.yml";

      await fetch(`https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflow}/dispatches`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ref, inputs: dataAlvo ? { data_alvo: dataAlvo } : {} }),
      });
    } catch (_) {
      // ignora — cron de 5 min serve de fallback
    }
  }

  async function salvarContagem() {
    const codigoTrim = codigo.trim();
    if (!codigoTrim) { setErro("Informe o código contado."); return; }
    if (quantidade === "" || Number.isNaN(Number(quantidade))) { setErro("Informe uma quantidade válida."); return; }
    setBusy(true); setErro("");
    const qtd = Number(quantidade);
    const saldoErp = peca?.saldo_erp ?? null;
    const diff = saldoErp !== null && saldoErp !== undefined ? qtd - Number(saldoErp) : null;
    const payload = {
      peca_id: peca?.id || null,
      codigo: peca?.codigo || codigoTrim,
      descricao: peca?.descricao || "Sem cadastro",
      localizacao: peca?.localizacao || null,
      unidade: peca?.unidade_padrao || null,
      quantidade: qtd,
      saldo_erp: saldoErp,
      diferenca: diff,
      observacao: observacao.trim() || null,
      contado_por_id: userInfo.id,
      contado_por_login: userInfo.login,
      contado_por_nome: userInfo.nome,
      origem: (typeof Capacitor !== "undefined" && Capacitor?.isNativePlatform?.()) ? "mobile" : "web",
      lote_id: loteId || null,
    };
    const { error } = await supabase.from("suprimentos_contagens").insert(payload);
    setBusy(false);
    if (error) { setErro(error.message); return; }
    setCodigo(""); setPeca(null); setNaoCadastrado(false); setQuantidade(""); setObservacao(""); setAviso("");
    setTimeout(() => codigoInputRef.current?.focus(), 50);
    carregarLotes();
    // Mobile: dispara workflow automaticamente (Edge Function debouncia por lote_id)
    if (isNativeShell) void dispararDispatchSilencioso("diaria", todayIsoBRT(), loteId);
  }

  async function salvarContagemFluxo() {
    const codigoTrim = codigo.trim();
    if (!codigoTrim) { setErro("Informe o codigo contado."); return false; }
    if (quantidade === "" || Number.isNaN(Number(quantidade))) { setErro("Informe uma quantidade valida."); return false; }
    setBusy(true);
    setErro("");

    const qtd = Number(quantidade);
    const saldoErp = peca?.saldo_erp ?? null;
    const diff = saldoErp !== null && saldoErp !== undefined ? qtd - Number(saldoErp) : null;
    const payload = {
      peca_id: peca?.id || null,
      codigo: peca?.codigo || codigoTrim,
      descricao: peca?.descricao || "Sem cadastro",
      localizacao: peca?.localizacao || null,
      unidade: peca?.unidade_padrao || null,
      quantidade: qtd,
      saldo_erp: saldoErp,
      diferenca: diff,
      observacao: observacao.trim() || null,
      contado_por_id: userInfo.id,
      contado_por_login: userInfo.login,
      contado_por_nome: userInfo.nome,
      origem: (typeof Capacitor !== "undefined" && Capacitor?.isNativePlatform?.()) ? "mobile" : "web",
      lote_id: loteId || null,
    };

    const { error } = await supabase.from("suprimentos_contagens").insert(payload);
    setBusy(false);
    if (error) { setErro(error.message); return false; }
    limparApontamento();
    // Mobile: dispara workflow automaticamente (Edge Function debouncia por lote_id)
    if (isNativeShell) void dispararDispatchSilencioso("diaria", todayIsoBRT(), loteId);
    return true;
  }

  function iniciarFluxo() {
    limparApontamento();
    setItensSessao(0);
    setLoteId(novoLoteId());
    setFluxoAtivo(true);
    setTimeout(() => setScannerOpen(true), 150);
  }

  async function proximoItem() {
    const ok = await salvarContagemFluxo();
    if (!ok) return;
    setItensSessao((current) => current + 1);
    setAviso("Item salvo. Aponte o proximo codigo.");
    setTimeout(() => setScannerOpen(true), 250);
  }

  async function finalizarFluxo() {
    // Se tem um item parcialmente preenchido (qtd > 0 ou peca selecionada), salva antes
    const podeSalvarPendente =
      String(quantidade).trim() !== "" &&
      !Number.isNaN(Number(quantidade)) &&
      (peca || naoCadastrado) &&
      codigo.trim() !== "";

    if (podeSalvarPendente) {
      try {
        await salvarContagemFluxo();
      } catch (_) {
        /* ignora */
      }
    }

    setScannerOpen(false);
    setFluxoAtivo(false);
    limparApontamento();
    if (isNativeShell && (itensSessao > 0 || podeSalvarPendente) && loteId) {
      void dispararDispatchSilencioso("diaria", todayIsoBRT(), loteId);
    }
    setLoteId(null);
  }

  function handleScan(text) {
    setScannerOpen(false);
    setCodigo(text);
    buscarPeca(text);
  }

  // ─── Lotes (Diária / Lubrificantes = por dia ; Semanal = auditorias) ──
  const [tab, setTab] = useState("diaria");
  const [lotesPorTipo, setLotesPorTipo] = useState({ diaria: [], lubrificantes: [] });
  const [lotesSemanais, setLotesSemanais] = useState([]);
  const [loadingLotes, setLoadingLotes] = useState(true);
  const lotesDiarios = lotesPorTipo.diaria;

  async function carregarLotes() {
    setLoadingLotes(true);
    const [contagensRes, auditoriasRes] = await Promise.all([
      supabase.from("suprimentos_contagens")
        .select("id,codigo,quantidade,saldo_erp,diferenca,peca_id,created_at,contado_por_nome,tipo_contagem,lote_id")
        .order("created_at", { ascending: false })
        .limit(5000),
      supabase.from("suprimentos_auditorias")
        .select("*")
        .eq("tipo", "semanal")
        .order("data_fim", { ascending: false })
        .limit(50),
    ]);
    const contagens = contagensRes.data || [];
    setLotesSemanais(auditoriasRes.data || []);

    // Agrupa por (tipo, lote_id) -- contagens sem lote_id usam o dia como chave (fallback)
    const buckets = { diaria: new Map(), lubrificantes: new Map() };
    contagens.forEach((c) => {
      const tipo = (c.tipo_contagem || "diaria").toLowerCase();
      if (tipo === "semanal") return;
      const byLote = buckets[tipo] || buckets.diaria;
      const d = new Date(c.created_at);
      const dayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const key = c.lote_id || `dia:${dayStr}`;
      const cur = byLote.get(key) || {
        key,
        lote_id: c.lote_id || null,
        data: dayStr,
        primeira: c.created_at,
        ultima: c.created_at,
        tipo,
        total: 0,
        corretos: 0,
        divergencias: 0,
        sem_cadastro: 0,
        sem_conferir: 0,
        conferidos: 0,
        contadores: new Set(),
      };
      cur.total += 1;
      const semCad = !c.peca_id;
      const conferido = c.saldo_erp !== null && c.saldo_erp !== undefined;
      if (semCad) cur.sem_cadastro += 1;
      if (!conferido) cur.sem_conferir += 1;
      else {
        cur.conferidos += 1;
        if (Number(c.diferenca || 0) === 0) cur.corretos += 1;
        else cur.divergencias += 1;
      }
      if (c.contado_por_nome) cur.contadores.add(c.contado_por_nome);
      // mantém a janela do lote
      if (c.created_at < cur.primeira) cur.primeira = c.created_at;
      if (c.created_at > cur.ultima) cur.ultima = c.created_at;
      byLote.set(key, cur);
    });

    function finaliza(map) {
      const arr = Array.from(map.values()).map((l) => ({
        ...l,
        contadores: Array.from(l.contadores),
        acuracidade: l.conferidos > 0 ? Math.round((l.corretos / l.conferidos) * 1000) / 10 : null,
      }));
      arr.sort((a, b) => (a.ultima < b.ultima ? 1 : -1));
      return arr.slice(0, 10);
    }

    setLotesPorTipo({
      diaria: finaliza(buckets.diaria),
      lubrificantes: finaliza(buckets.lubrificantes),
    });
    setLoadingLotes(false);
  }

  function abrirLote(lote) {
    if (lote.lote_id) navigate(`/suprimentos/contagem/lote/${lote.lote_id}`);
    else navigate(`/suprimentos/contagem/dia/${lote.data}`);
  }

  useEffect(() => {
    if (!isNativeShell) carregarLotes();
    else setLoadingLotes(false);
  }, [isNativeShell]);

  // Realtime: atualiza a lista de lotes sem precisar dar F5.
  useEffect(() => {
    let recarregando = false;
    const debounceRecarregar = () => {
      if (recarregando) return;
      recarregando = true;
      setTimeout(() => { recarregando = false; carregarLotes(); }, 800);
    };
    const channel = supabase
      .channel("contagem-central")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "suprimentos_contagens" },
        () => debounceRecarregar()
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "suprimentos_bot_jobs" },
        () => debounceRecarregar()
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "suprimentos_auditorias" },
        () => debounceRecarregar()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // ─── KPIs ──────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const total = lotesDiarios.reduce((sum, l) => sum + l.total, 0);
    const hoje = new Date();
    const hojeKey = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;
    const hojeLote = lotesDiarios.find((l) => l.data === hojeKey);
    const divergencia = lotesDiarios.reduce((sum, l) => sum + l.divergencias, 0);
    const sem_cadastro = lotesDiarios.reduce((sum, l) => sum + l.sem_cadastro, 0);
    return { total, hojeCount: hojeLote?.total || 0, divergencia, sem_cadastro };
  }, [lotesDiarios]);

  if (isNativeShell) {
    return (
      <PullToRefresh onRefresh={carregarLotes}>
      <div className="min-h-[calc(100vh-120px)] bg-slate-50 p-4 pb-24">
        <div className="mx-auto flex max-w-md flex-col gap-4">
          <header className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-[11px] font-black uppercase tracking-[0.28em] text-blue-600">Suprimentos</p>
            <h1 className="mt-2 text-2xl font-black text-slate-950">Contagem</h1>
            <p className="mt-2 text-sm font-semibold text-slate-500">
              {fluxoAtivo ? `${itensSessao} item(ns) salvo(s) nesta sessao.` : "Inicie uma sessao para contar item por item."}
            </p>
          </header>

          {!fluxoAtivo ? (
            <div className="space-y-3">
              <button
                type="button"
                onClick={iniciarFluxo}
                className="flex min-h-[180px] w-full flex-col items-start justify-end rounded-[32px] bg-gradient-to-br from-emerald-600 to-teal-800 p-6 text-left text-white shadow-xl active:scale-[0.98]"
              >
                <span className="mb-5 inline-flex h-16 w-16 items-center justify-center rounded-3xl bg-white/15 text-3xl">
                  <FaBarcode />
                </span>
                <span className="text-2xl font-black">Iniciar contagem</span>
                <span className="mt-2 text-sm font-semibold text-white/80">Escaneie, informe a quantidade e avance para o proximo item.</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMobileCentralOpen((current) => {
                    const next = !current;
                    if (next && !lotesDiarios.length) carregarLotes();
                    return next;
                  });
                }}
                className="flex w-full items-center justify-between rounded-3xl border border-slate-200 bg-white px-5 py-4 text-left text-slate-950 shadow-sm active:scale-[0.98]"
              >
                <span>
                  <span className="block text-base font-black">Central</span>
                  <span className="mt-0.5 block text-xs font-semibold text-slate-500">Ver contagens, lotes e divergencias.</span>
                </span>
                <FaChevronRight className={`text-slate-400 transition ${mobileCentralOpen ? "rotate-90" : ""}`} />
              </button>

              {mobileCentralOpen ? (
                <div className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Central</p>
                      <h2 className="text-lg font-black text-slate-950">Contagens recentes</h2>
                    </div>
                    <span className="rounded-2xl bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">{kpis.total}</span>
                  </div>

                  {loadingLotes ? (
                    <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm font-bold text-slate-500">Carregando...</p>
                  ) : lotesDiarios.length ? (
                    <div className="space-y-2">
                      {lotesDiarios.slice(0, 12).map((lote) => {
                        const hora = new Date(lote.ultima || lote.primeira).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
                        return (
                          <button
                            key={lote.key}
                            type="button"
                            onClick={() => abrirLote(lote)}
                            className="flex w-full items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-left active:scale-[0.99]"
                          >
                            <span>
                              <span className="block text-sm font-black text-slate-950">{formatDateBR(lote.data)} · {hora}</span>
                              <span className="text-xs font-semibold text-slate-500">
                                {lote.total} item(ns) · {lote.divergencias} divergencia(s)
                                {lote.acuracidade !== null ? ` · ${lote.acuracidade}%` : ""}
                              </span>
                            </span>
                            <FaChevronRight className="text-slate-400" />
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm font-bold text-slate-500">Nenhuma contagem encontrada.</p>
                  )}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Item atual</p>
                  <h2 className="text-lg font-black text-slate-950">{codigo ? "Conferir quantidade" : "Aguardando codigo"}</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setScannerOpen(true)}
                  className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-sm"
                  aria-label="Escanear"
                >
                  <FaCamera />
                </button>
              </div>

              <div className="space-y-4">
                <Field label="Codigo">
                  <div className="flex gap-2">
                    <input
                      ref={codigoInputRef}
                      className={inputClass}
                      placeholder="Escaneie ou digite"
                      value={codigo}
                      onChange={(e) => setCodigo(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); buscarPeca(codigo); } }}
                    />
                    <button
                      type="button"
                      onClick={() => buscarPeca(codigo)}
                      disabled={busy || !codigo.trim()}
                      className="rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      <FaSearch />
                    </button>
                  </div>
                </Field>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Peca</p>
                  <p className="mt-2 text-base font-black text-slate-950">
                    {peca?.descricao || (naoCadastrado ? "Sem cadastro" : "Aguardando leitura")}
                  </p>
                  {peca?.saldo_erp !== null && peca?.saldo_erp !== undefined ? (
                    <p className="mt-1 text-xs font-semibold text-slate-500">Saldo ERP: {peca.saldo_erp}</p>
                  ) : null}
                </div>

                <Field label="Quantidade">
                  <input
                    ref={qtdInputRef}
                    type="number"
                    min="0"
                    step="0.01"
                    className={`${inputClass} text-center text-2xl font-black`}
                    placeholder="0"
                    value={quantidade}
                    onChange={(e) => setQuantidade(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); proximoItem(); } }}
                    disabled={!peca && !naoCadastrado}
                  />
                </Field>

                <Field label="Observacao">
                  <input
                    className={inputClass}
                    placeholder="opcional"
                    value={observacao}
                    onChange={(e) => setObservacao(e.target.value)}
                  />
                </Field>

                {aviso ? <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-700">{aviso}</p> : null}
                {erro ? <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{erro}</p> : null}
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={finalizarFluxo}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm font-black text-slate-700"
                >
                  Finalizar
                </button>
                <button
                  type="button"
                  onClick={proximoItem}
                  disabled={busy || quantidade === "" || (!peca && !naoCadastrado)}
                  className="rounded-2xl bg-emerald-600 px-4 py-4 text-sm font-black text-white shadow-sm disabled:opacity-50"
                >
                  Proximo
                </button>
              </div>
            </div>
          )}
        </div>

        <BarcodeScanner open={scannerOpen} onClose={() => setScannerOpen(false)} onScan={handleScan} />
      </div>
      </PullToRefresh>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHero
        eyebrow="Suprimentos · Contagem"
        title="Contagem de Itens"
        description="Aponte o código de barras ou digite o código para registrar a contagem física da peça."
        actions={
          <ActionButton tone="blue" onClick={() => setScannerOpen(true)}>
            <FaCamera /> Escanear código
          </ActionButton>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard title="Contagens totais" value={kpis.total} subtitle="Registradas no histórico" icon={<FaBarcode />} tone="blue" />
        <KpiCard title="Contadas hoje" value={kpis.hojeCount} subtitle="Itens apontados no dia atual" icon={<FaCheck />} tone="cyan" />
        <KpiCard title="Com divergência" value={kpis.divergencia} subtitle="Quantidade diferente do ERP" icon={<FaRedo />} tone="amber" />
        <KpiCard title="Sem cadastro" value={kpis.sem_cadastro} subtitle="Códigos contados que não estão na base" icon={<FaTimes />} tone="rose" />
      </section>

      <Panel title="Registrar contagem" subtitle="Cada apontamento gera um registro independente.">
        <div className="grid gap-4 md:grid-cols-[1fr_1fr_0.6fr_1fr]">
          <Field label="Código" required>
            <div className="flex gap-2">
              <input
                ref={codigoInputRef}
                className={inputClass}
                placeholder="Digite ou escaneie"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); buscarPeca(codigo); } }}
                autoFocus
              />
              <button
                type="button"
                onClick={() => buscarPeca(codigo)}
                disabled={busy || !codigo.trim()}
                className="rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                <FaSearch />
              </button>
              <button
                type="button"
                onClick={() => setScannerOpen(true)}
                className="rounded-xl border border-blue-200 bg-blue-50 px-4 text-sm font-semibold text-blue-700 hover:bg-blue-100"
                title="Escanear pela câmera"
              >
                <FaCamera />
              </button>
            </div>
          </Field>

          <Field label="Peça">
            <input
              className={inputClass}
              value={peca?.descricao || (naoCadastrado ? "Sem cadastro (será apontado na central)" : "")}
              placeholder="Aguardando código..."
              readOnly
            />
          </Field>

          <Field label="Quantidade contada" required>
            <input
              ref={qtdInputRef}
              type="number"
              min="0"
              step="0.01"
              className={inputClass}
              placeholder="0"
              value={quantidade}
              onChange={(e) => setQuantidade(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); salvarContagem(); } }}
              disabled={!peca && !naoCadastrado}
            />
          </Field>

          <Field label="Observação">
            <input
              className={inputClass}
              placeholder="opcional"
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
            />
          </Field>
        </div>

        {aviso ? (
          <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700">{aviso}</p>
        ) : null}
        {erro ? (
          <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700">{erro}</p>
        ) : null}

        <div className="mt-4 flex flex-wrap justify-end gap-3">
          <ActionButton onClick={() => { setCodigo(""); setPeca(null); setNaoCadastrado(false); setQuantidade(""); setObservacao(""); setErro(""); setAviso(""); }}>
            Limpar
          </ActionButton>
          <ActionButton tone="emerald" onClick={salvarContagem} disabled={busy || quantidade === "" || (!peca && !naoCadastrado)}>
            <FaCheck /> Salvar contagem
          </ActionButton>
        </div>
      </Panel>

      <Panel
        title="Lotes de contagem"
        subtitle="Mostrando os últimos 10 lotes por tipo. Clique para abrir."
        actions={
          <div className="flex gap-2">
            {[
              { key: "diaria", label: "Contagem Diária" },
              { key: "semanal", label: "Contagem Semanal" },
              { key: "lubrificantes", label: "Lubrificantes" },
            ].map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${tab === t.key ? "bg-blue-600 text-white" : "border border-slate-200 text-slate-600 hover:bg-slate-100"}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        }
      >
        {loadingLotes ? (
          <p className="py-12 text-center text-sm font-semibold text-slate-400">Carregando...</p>
        ) : (tab === "diaria" || tab === "lubrificantes") ? (
          (lotesPorTipo[tab] || []).length === 0 ? (
            <EmptyState
              title={tab === "lubrificantes" ? "Sem lotes de lubrificantes" : "Sem lotes diários"}
              subtitle="Faça a primeira contagem desse tipo para abrir um lote."
            />
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50">
                  <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-3">Data</th>
                    <th className="px-4 py-3 text-right">Itens</th>
                    <th className="px-4 py-3 text-right">Conferidos</th>
                    <th className="px-4 py-3 text-right">Acuracidade</th>
                    <th className="px-4 py-3 text-right">Divergências</th>
                    <th className="px-4 py-3 text-right">Sem cadastro</th>
                    <th className="px-4 py-3">Contadores</th>
                    <th className="px-4 py-3 text-right"></th>
                  </tr>
                </thead>
                <tbody>
                  {(lotesPorTipo[tab] || []).map((l) => {
                    const hora = new Date(l.ultima || l.primeira).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
                    return (
                    <tr
                      key={`${tab}-${l.key}`}
                      onClick={() => abrirLote(l)}
                      className="cursor-pointer border-t border-slate-100 transition hover:bg-blue-50/60"
                    >
                      <td className="px-4 py-3 font-semibold text-slate-900">{formatDateBR(l.data)} <span className="ml-1 text-xs font-normal text-slate-500">{hora}</span></td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-700">{l.total}</td>
                      <td className="px-4 py-3 text-right text-slate-700">{l.conferidos}</td>
                      <td className="px-4 py-3 text-right">
                        {l.acuracidade === null ? (
                          <span className="text-slate-400">—</span>
                        ) : (
                          <StatusChip
                            label={`${l.acuracidade}%`}
                            tone={l.acuracidade >= 95 ? "emerald" : l.acuracidade >= 80 ? "amber" : "rose"}
                          />
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {l.divergencias > 0 ? <StatusChip label={String(l.divergencias)} tone="amber" /> : <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {l.sem_cadastro > 0 ? <StatusChip label={String(l.sem_cadastro)} tone="rose" /> : <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        {l.contadores.slice(0, 3).join(", ")}{l.contadores.length > 3 ? ` +${l.contadores.length - 3}` : ""}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-400">
                        <FaChevronRight />
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : (
          lotesSemanais.length === 0 ? (
            <EmptyState title="Sem auditorias semanais" subtitle="O bot semanal roda toda segunda 03h. Você também pode disparar manual em GitHub Actions." />
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50">
                  <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-3">Período</th>
                    <th className="px-4 py-3 text-right">Itens</th>
                    <th className="px-4 py-3 text-right">Corretos</th>
                    <th className="px-4 py-3 text-right">Errados</th>
                    <th className="px-4 py-3 text-right">Sem contagem</th>
                    <th className="px-4 py-3">Quando</th>
                    <th className="px-4 py-3 text-right"></th>
                  </tr>
                </thead>
                <tbody>
                  {lotesSemanais.map((a) => {
                    const r = a.resumo_json || {};
                    return (
                      <tr
                        key={a.id}
                        onClick={() => navigate(`/suprimentos/contagem/semanal/${a.id}`)}
                        className="cursor-pointer border-t border-slate-100 transition hover:bg-blue-50/60"
                      >
                        <td className="px-4 py-3 font-semibold text-slate-900">
                          {formatDateBR(a.data_inicio)} → {formatDateBR(a.data_fim)}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-700">{r.itens_total ?? "—"}</td>
                        <td className="px-4 py-3 text-right text-emerald-700">{r.itens_corretos ?? "—"}</td>
                        <td className="px-4 py-3 text-right text-rose-700">{r.itens_errados ?? "—"}</td>
                        <td className="px-4 py-3 text-right text-slate-500">{r.itens_sem_contagem ?? "—"}</td>
                        <td className="px-4 py-3 text-xs text-slate-500">{formatDateTimeBR(a.created_at)}</td>
                        <td className="px-4 py-3 text-right text-slate-400">
                          {a.excel_url ? (
                            <a href={a.excel_url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1 text-blue-600 hover:underline">
                              <FaDownload /> Excel
                            </a>
                          ) : <FaChevronRight />}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        )}
      </Panel>

      <BarcodeScanner open={scannerOpen} onClose={() => setScannerOpen(false)} onScan={handleScan} />
    </div>
  );
}
