const SHELL_CACHE = "unraid-pwa-shell-v4";
const DATA_CACHE = "unraid-pwa-data-v3";
const SHELL_ASSETS = ["/", "/index.html", "/manifest.webmanifest", "/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then(async (keys) => {
      await Promise.all(
        keys
          .filter((key) => key !== SHELL_CACHE && key !== DATA_CACHE)
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    }),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== "GET") {
    return;
  }

  if (url.origin === self.location.origin && url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(request)
        .then(async (response) => {
          const cache = await caches.open(DATA_CACHE);
          cache.put(request, response.clone());
          return response;
        })
        .catch(async () => {
          const cache = await caches.open(DATA_CACHE);
          const cached = await cache.match(request);
          if (cached) {
            return cached;
          }
          return new Response(
            JSON.stringify({ error: "offline", message: "No cached snapshot available." }),
            { status: 503, headers: { "content-type": "application/json" } },
          );
        }),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        return cached;
      }
      return fetch(request).then(async (response) => {
        if (url.origin === self.location.origin) {
          const cache = await caches.open(SHELL_CACHE);
          cache.put(request, response.clone());
        }
        return response;
      });
    }),
  );
});
