import { useEffect, useMemo, useState } from "react";
import { Download, Smartphone, X } from "lucide-react";

function isStandaloneMode() {
  return window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator.standalone === true;
}

export default function InstallAppPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    document.body.classList.toggle("standalone-app", isStandaloneMode());

    function handleBeforeInstallPrompt(event) {
      event.preventDefault();
      setDeferredPrompt(event);
      setVisible(true);
    }

    function handleInstalled() {
      setDeferredPrompt(null);
      setVisible(false);
    }

    if (!isStandaloneMode()) {
      window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.addEventListener("appinstalled", handleInstalled);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  const isiOS = useMemo(() => /iphone|ipad|ipod/i.test(window.navigator.userAgent), []);
  const shouldShowIosHint = visible || (isiOS && !isStandaloneMode());

  async function handleInstall() {
    if (!deferredPrompt) return;

    await deferredPrompt.prompt();
    const outcome = await deferredPrompt.userChoice;

    if (outcome.outcome !== "accepted") {
      setVisible(false);
      return;
    }

    setDeferredPrompt(null);
    setVisible(false);
  }

  if (isStandaloneMode() || (!deferredPrompt && !shouldShowIosHint)) {
    return null;
  }

  return (
    <div className="safe-bottom fixed inset-x-0 bottom-0 z-50 px-3 pb-3 md:px-4">
      <div className="mx-auto flex max-w-3xl items-center gap-3 rounded-3xl border border-slate-200 bg-white/96 px-4 py-3 shadow-2xl backdrop-blur">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-100 text-blue-700">
          {deferredPrompt ? <Download size={20} /> : <Smartphone size={20} />}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900">Instalar Inove no aparelho</p>
          <p className="text-xs leading-5 text-slate-600">
            {deferredPrompt
              ? "Use a mesma base do site como app no Android ou iPhone, com acesso mais rapido e tela cheia."
              : "No iPhone, abra o compartilhamento do Safari e toque em Adicionar a Tela de Inicio para usar como app."}
          </p>
        </div>

        {deferredPrompt ? (
          <button
            type="button"
            onClick={handleInstall}
            className="rounded-2xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            Instalar
          </button>
        ) : null}

        <button
          type="button"
          onClick={() => setVisible(false)}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
          aria-label="Fechar aviso de instalacao"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
}
