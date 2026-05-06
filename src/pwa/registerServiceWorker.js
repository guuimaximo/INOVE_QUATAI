// Keep a pending update visible even if the modal mounts after the version check runs.
const VERSION_CHECK_INTERVAL_MS = 30 * 1000;
const UPDATE_STORAGE_KEY = "inove:update-available-version";
const UPDATE_PROMPT_ID = "inove-update-fallback-prompt";

let updateInFlight = false;
let announcedVersion = null;

export function getStoredUpdateVersion() {
  try {
    return window.localStorage.getItem(UPDATE_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function clearStoredUpdateVersion() {
  try {
    window.localStorage.removeItem(UPDATE_STORAGE_KEY);
  } catch {
    // Ignore storage access issues.
  }
}

function storeUpdateVersion(version) {
  if (!version) return;

  try {
    window.localStorage.setItem(UPDATE_STORAGE_KEY, version);
  } catch {
    // Ignore storage access issues.
  }
}

function removeFallbackPrompt() {
  const existing = document.getElementById(UPDATE_PROMPT_ID);
  if (existing) {
    existing.remove();
  }
}

function showFallbackPrompt() {
  if (typeof document === "undefined") return;
  if (window.__INOVE_REACT_UPDATE_PROMPT_VISIBLE__) return;
  if (document.getElementById(UPDATE_PROMPT_ID)) return;
  // This fallback keeps the update CTA visible even if the React tree misses the first event.

  const overlay = document.createElement("div");
  overlay.id = UPDATE_PROMPT_ID;
  overlay.style.position = "fixed";
  overlay.style.inset = "0";
  overlay.style.zIndex = "9999";
  overlay.style.display = "flex";
  overlay.style.alignItems = "center";
  overlay.style.justifyContent = "center";
  overlay.style.padding = "16px";
  overlay.style.background = "rgba(15, 23, 42, 0.35)";
  overlay.style.backdropFilter = "blur(2px)";

  const card = document.createElement("div");
  card.style.width = "100%";
  card.style.maxWidth = "420px";
  card.style.borderRadius = "24px";
  card.style.border = "1px solid #dbeafe";
  card.style.background = "#ffffff";
  card.style.boxShadow = "0 25px 50px -12px rgba(15, 23, 42, 0.35)";
  card.style.padding = "24px";
  card.innerHTML = `
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;">
      <div>
        <div style="font-size:20px;font-weight:800;color:#0f172a;">Atualizacao disponivel</div>
        <div style="margin-top:8px;font-size:14px;line-height:1.5;color:#475569;">
          Uma nova versao do Inove foi publicada. Clique em <strong>Atualizar</strong> para recarregar a pagina com o build mais recente.
        </div>
      </div>
      <button type="button" data-role="close" style="border:none;background:transparent;color:#64748b;font-size:18px;font-weight:700;cursor:pointer;">×</button>
    </div>
    <div style="margin-top:16px;border:1px solid #bfdbfe;background:#eff6ff;border-radius:16px;padding:12px 14px;font-size:13px;color:#1d4ed8;">
      Se a tela ficou aberta durante o deploy, este aviso aparece para evitar que a pessoa precise sair e entrar de novo.
    </div>
    <div style="margin-top:20px;display:flex;justify-content:flex-end;gap:12px;">
      <button type="button" data-role="later" style="border:1px solid #e2e8f0;background:#fff;color:#475569;border-radius:16px;padding:10px 16px;font-size:14px;font-weight:700;cursor:pointer;">Depois</button>
      <button type="button" data-role="refresh" style="border:none;background:#059669;color:#fff;border-radius:16px;padding:10px 16px;font-size:14px;font-weight:700;cursor:pointer;">Atualizar</button>
    </div>
  `;

  overlay.appendChild(card);
  document.body.appendChild(overlay);

  overlay.querySelector('[data-role="close"]')?.addEventListener("click", removeFallbackPrompt);
  overlay.querySelector('[data-role="later"]')?.addEventListener("click", removeFallbackPrompt);
  overlay.querySelector('[data-role="refresh"]')?.addEventListener("click", async (event) => {
    const button = event.currentTarget;
    if (button instanceof HTMLButtonElement) {
      button.disabled = true;
      button.textContent = "Atualizando...";
      button.style.opacity = "0.75";
      button.style.cursor = "wait";
    }

    await hardRefreshApp();
  });
}

function notifyUpdateAvailable({ registration = null, version = null } = {}) {
  if (version && version !== __APP_BUILD_ID__) {
    storeUpdateVersion(version);
    announcedVersion = version;
  }

  window.dispatchEvent(
    new CustomEvent("inove:update-available", {
      detail: { registration, version },
    }),
  );

  window.setTimeout(() => {
    if (!window.__INOVE_REACT_UPDATE_PROMPT_VISIBLE__) {
      showFallbackPrompt();
    }
  }, 250);
}

function applyUpdateNow(registration) {
  if (!registration?.waiting || updateInFlight) return;

  updateInFlight = true;
  clearStoredUpdateVersion();
  removeFallbackPrompt();

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

    if (!publishedVersion) {
      return;
    }

    if (publishedVersion === __APP_BUILD_ID__) {
      announcedVersion = null;
      clearStoredUpdateVersion();
      return;
    }

    if (announcedVersion === publishedVersion || getStoredUpdateVersion() === publishedVersion) {
      return;
    }

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
    notifyUpdateAvailable({ registration, version: getStoredUpdateVersion() || "pending" });
  }

  registration.addEventListener("updatefound", () => {
    const newWorker = registration.installing;
    if (!newWorker) return;

    newWorker.addEventListener("statechange", () => {
      if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
        notifyUpdateAvailable({ registration, version: getStoredUpdateVersion() || "pending" });
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
  clearStoredUpdateVersion();
  removeFallbackPrompt();

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

  const registerWorker = () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        watchServiceWorkerRegistration(registration);
      })
      .catch((error) => {
        console.error("Falha ao registrar service worker do Inove:", error);
      });
  };

  if (document.readyState === "complete") {
    registerWorker();
    return;
  }

  window.addEventListener("load", registerWorker, { once: true });
}
