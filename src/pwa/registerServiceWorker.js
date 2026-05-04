function notifyUpdateAvailable(registration) {
  window.dispatchEvent(
    new CustomEvent("inove:update-available", {
      detail: { registration },
    }),
  );
}

function watchServiceWorkerRegistration(registration) {
  if (registration.waiting) {
    notifyUpdateAvailable(registration);
  }

  registration.addEventListener("updatefound", () => {
    const newWorker = registration.installing;
    if (!newWorker) return;

    newWorker.addEventListener("statechange", () => {
      if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
        notifyUpdateAvailable(registration);
      }
    });
  });

  const refreshForUpdates = () => {
    registration.update().catch((error) => {
      console.error("Falha ao verificar atualizacoes do Inove:", error);
    });
  };

  window.setInterval(refreshForUpdates, 5 * 60 * 1000);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      refreshForUpdates();
    }
  });
}

export function registerServiceWorker({ disable = false } = {}) {
  if (disable || !("serviceWorker" in navigator) || import.meta.env.DEV) {
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        watchServiceWorkerRegistration(registration);
      })
      .catch((error) => {
        console.error("Falha ao registrar service worker do Inove:", error);
      });
  });
}
