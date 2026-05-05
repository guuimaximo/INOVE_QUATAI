import { useEffect, useState } from "react";
import { RefreshCw, X } from "lucide-react";

import { hardRefreshApp } from "../pwa/registerServiceWorker";

export default function UpdateAppPrompt() {
  const [registration, setRegistration] = useState(null);
  const [visible, setVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    function handleUpdateAvailable(event) {
      setRegistration(event.detail?.registration || null);
      setVisible(true);
    }

    function handleControllerChange() {
      window.location.reload();
    }

    window.addEventListener("inove:update-available", handleUpdateAvailable);
    navigator.serviceWorker?.addEventListener("controllerchange", handleControllerChange);

    return () => {
      window.removeEventListener("inove:update-available", handleUpdateAvailable);
      navigator.serviceWorker?.removeEventListener("controllerchange", handleControllerChange);
    };
  }, []);

  async function handleRefresh() {
    setRefreshing(true);

    try {
      if (registration?.waiting) {
        registration.waiting.postMessage({ type: "SKIP_WAITING" });
        return;
      }

      await hardRefreshApp();
    } catch (error) {
      console.error("Falha ao atualizar o Inove:", error);
      setRefreshing(false);
    }
  }

  if (!visible) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/35 px-4 pb-6 pt-20 backdrop-blur-[2px] sm:items-center sm:pb-4">
      <div className="w-full max-w-md rounded-[28px] border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-blue-700">
              <RefreshCw size={20} />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900">Atualizacao disponivel</h2>
              <p className="mt-1 text-sm text-slate-500">
                {refreshing
                  ? "Aplicando a versao mais recente do Inove neste navegador."
                  : "Uma nova versao acabou de ser publicada e ja pode ser carregada agora."}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setVisible(false)}
            disabled={refreshing}
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Fechar aviso de atualizacao"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          {refreshing ? (
            <>Aguarde alguns segundos enquanto a pagina recarrega com o build mais recente.</>
          ) : (
            <>
              Clique em <span className="font-bold">Atualizar</span> para resetar a pagina e carregar o build mais
              recente do Render.
            </>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={() => setVisible(false)}
            disabled={refreshing}
            className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Depois
          </button>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
            {refreshing ? "Atualizando..." : "Atualizar"}
          </button>
        </div>
      </div>
    </div>
  );
}
