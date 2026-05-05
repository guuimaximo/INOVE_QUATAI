const VERSION_CHECK_INTERVAL_MS = 60 * 1000;

let updateInFlight = false;
let announcedVersion = null;

function notifyUpdateAvailable({ registration = null, version = null } = {}) {
  window.dispatchEvent(
    new CustomEvent("inove:update-available", {
      detail: { registration, version },
    }),
  );
}

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

async function checkVersionUpdate() {
  try {
    const response = await fetch(`/version.json?t=${Date.now()}`, {
      cache: "no-store",
      headers: {
        "cache-control": "no-cache",
      },
    });

    if (!response.ok) return;

    const payload = await response.json();
    const publishedVersion = payload?.version;

    if (!publishedVersion || publishedVersion === __APP_BUILD_ID__ || announcedVersion === publishedVersion) {
      return;
    }

    announcedVersion = publishedVersion;
    notifyUpdateAvailable({ version: publishedVersion });
  } catch (error) {
    console.error("Falha ao verificar se existe uma nova versao do Inove:", error);
  }
}

function startVersionPolling() {
  const refreshVersion = () => {
    void checkVersionUpdate();
  };

  window.setInterval(refreshVersion, VERSION_CHECK_INTERVAL_MS);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      refreshVersion();
    }
  });
  window.addEventListener("focus", refreshVersion);

  refreshVersion();
}

function watchServiceWorkerRegistration(registration) {
  if (registration.waiting) {
    notifyUpdateAvailable({ registration });
  }

  registration.addEventListener("updatefound", () => {
    const newWorker = registration.installing;
    if (!newWorker) return;

    newWorker.addEventListener("statechange", () => {
      if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
        notifyUpdateAvailable({ registration });
      }
    });
  });

  const refreshForUpdates = () => {
    registration.update().catch((error) => {
      console.error("Falha ao verificar atualizacoes do Inove:", error);
    });
  };

  window.setInterval(refreshForUpdates, VERSION_CHECK_INTERVAL_MS);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      refreshForUpdates();
    }
  });
  window.addEventListener("focus", refreshForUpdates);
}

export async function hardRefreshApp() {
  const registrations =
    typeof navigator.serviceWorker?.getRegistrations === "function"
      ? await navigator.serviceWorker.getRegistrations()
      : [];

  const waitingRegistration = registrations.find((registration) => registration.waiting);
  if (waitingRegistration) {
    applyUpdateNow(waitingRegistration);
    return;
  }

  if ("caches" in window) {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith("inove-app-shell-")).map((key) => caches.delete(key)));
  }

  window.location.reload();
}

export function registerServiceWorker({ disable = false } = {}) {
  if (disable || import.meta.env.DEV) {
    return;
  }

  startVersionPolling();

  if (!("serviceWorker" in navigator)) {
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
