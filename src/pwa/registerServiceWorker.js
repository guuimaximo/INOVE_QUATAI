export function registerServiceWorker({ disable = false } = {}) {
  if (disable || !("serviceWorker" in navigator) || import.meta.env.DEV) {
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.error("Falha ao registrar service worker do Inove:", error);
    });
  });
}
