import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const buildTimestamp = new Date().toISOString();
const buildId = `${process.env.RENDER_GIT_COMMIT || "local"}-${buildTimestamp}`
  .replace(/[^a-zA-Z0-9-]/g, "")
  .toLowerCase();

function createPwaAssetsPlugin() {
  return {
    name: "inove-pwa-assets",
    generateBundle() {
      const cacheName = `inove-app-shell-${buildId}`;
      const assetPaths = ["/", "/index.html", "/manifest.webmanifest", "/favicon.png"];
      const serviceWorkerSource = `const CACHE_NAME = ${JSON.stringify(cacheName)};
const ASSET_PATHS = ${JSON.stringify(assetPaths)};

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSET_PATHS);
    }),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        return cache.match("/index.html");
      }),
    );
    return;
  }

  if (url.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(request).then((response) => {
        if (!response || response.status !== 200 || response.type !== "basic") {
          return response;
        }

        const responseClone = response.clone();

        caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, responseClone);
        });

        return response;
      });
    }),
  );
});
`;

      this.emitFile({
        type: "asset",
        fileName: "version.json",
        source: JSON.stringify(
          {
            version: buildId,
            builtAt: buildTimestamp,
          },
          null,
          2,
        ),
      });

      this.emitFile({
        type: "asset",
        fileName: "sw.js",
        source: serviceWorkerSource,
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), createPwaAssetsPlugin()],
  define: {
    __APP_BUILD_ID__: JSON.stringify(buildId),
    __APP_BUILD_AT__: JSON.stringify(buildTimestamp),
  },
  build: {
    target: "es2019",
  },
});
