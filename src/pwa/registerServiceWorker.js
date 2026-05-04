let updateInFlight = false;

function applyUpdateNow(registration) {
  if (!registration?.waiting || updateInFlight) return;

  updateInFlight = true;

  navigator.serviceWorker?.addEventListener(
    "controllerchange",
    () => {
      window.location.reload();
    },
    { once: true },
  );

  registration.waiting.postMessage({ type: "SKIP_WAITING" });
}

function notifyUpdateAvailable(registration, autoApply = false) {
  window.dispatchEvent(
    new CustomEvent("inove:update-available", {
      detail: { registration, autoApply },
    }),
  );
}

function watchServiceWorkerRegistration(registration, { forceReload = false } = {}) {
  if (registration.waiting) {
    notifyUpdateAvailable(registration, forceReload);
    if (forceReload) {
      applyUpdateNow(registration);
    }
  }

  registration.addEventListener("updatefound", () => {
    const newWorker = registration.installing;
    if (!newWorker) return;

    newWorker.addEventListener("statechange", () => {
      if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
        notifyUpdateAvailable(registration, forceReload);
        if (forceReload) {
          applyUpdateNow(registration);
        }
      }
    });
  });

  const refreshForUpdates = () => {
    registration.update().catch((error) => {
      console.error("Falha ao verificar atualizações do Inove:", error);
    });
  };

  window.setInterval(refreshForUpdates, 5 * 60 * 1000);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      refreshForUpdates();
    }
  });
}

export function registerServiceWorker({ disable = false, forceReload = false } = {}) {
  if (disable || !("serviceWorker" in navigator) || import.meta.env.DEV) {
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        watchServiceWorkerRegistration(registration, { forceReload });
      })
      .catch((error) => {
        console.error("Falha ao registrar service worker do Inove:", error);
      });
  });
}
