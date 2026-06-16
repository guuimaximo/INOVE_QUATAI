import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FaTimes } from "react-icons/fa";

// Overlay de scanner de código de barras reutilizável.
// Usa BarcodeDetector nativo quando disponível, senão @zxing/browser.
export default function BarcodeScannerOverlay({
  open,
  onClose,
  onScan,
  title = "Apontar para o código de barras",
  subtitle = "",
}) {
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
    try { streamRef.current?.getTracks?.().forEach((t) => t.stop()); } catch {}
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
          stream.getTracks().forEach((t) => t.stop());
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

  const conteudo = (
    <div className="fixed inset-0 z-[120] flex flex-col bg-slate-950/90">
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-4 text-white">
        <div>
          {subtitle ? (
            <p className="text-[11px] font-medium uppercase tracking-wider text-blue-300">{subtitle}</p>
          ) : null}
          <h2 className="text-lg font-semibold">{title}</h2>
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

  if (typeof document !== "undefined") return createPortal(conteudo, document.body);
  return conteudo;
}
