const SHELL_CACHE = "unraid-pwa-shell-v5";
const DATA_CACHE = "unraid-pwa-data-v4";
const SHELL_ASSETS = ["/", "/index.html", "/manifest.webmanifest", "/icon.svg"];

const API_NETWORK_TIMEOUT_MS = 8000;
const API_CACHE_MAX_AGE_MS = 2 * 60 * 1000;
const API_CACHE_MAX_ENTRIES = 80;
const CACHE_TIME_HEADER = "x-unpwa-cached-at";

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

async function cloneWithHeaders(response, headersToSet) {
  const headers = new Headers(response.headers);
  Object.entries(headersToSet).forEach(([key, value]) => {
    headers.set(key, value);
  });
  const body = await response.arrayBuffer();
  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function fetchWithTimeout(request, timeoutMs) {
  if (!timeoutMs || timeoutMs <= 0) {
    return fetch(request);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    return await fetch(request, { signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function readFreshCachedApiResponse(cache, request) {
  const cached = await cache.match(request);
  if (!cached) {
    return null;
  }

  const cachedAt = Number(cached.headers.get(CACHE_TIME_HEADER));
  if (Number.isFinite(cachedAt) && Date.now() - cachedAt > API_CACHE_MAX_AGE_MS) {
    await cache.delete(request);
    return null;
  }

  return cloneWithHeaders(cached, { "x-unpwa-cache": "fallback" });
}

async function trimApiCache(cache) {
  const keys = await cache.keys();
  if (keys.length <= API_CACHE_MAX_ENTRIES) {
    return;
  }

  const entries = await Promise.all(
    keys.map(async (key) => {
      const response = await cache.match(key);
      const cachedAt = Number(response?.headers.get(CACHE_TIME_HEADER) ?? 0);
      return { key, cachedAt };
    }),
  );

  entries.sort((left, right) => left.cachedAt - right.cachedAt);
  const removeCount = Math.max(0, entries.length - API_CACHE_MAX_ENTRIES);
  await Promise.all(entries.slice(0, removeCount).map((entry) => cache.delete(entry.key)));
}

async function cacheApiResponse(cache, request, response) {
  const cacheableResponse = await cloneWithHeaders(response.clone(), {
    [CACHE_TIME_HEADER]: String(Date.now()),
  });
  await cache.put(request, cacheableResponse);
  await trimApiCache(cache);
}

async function handleApiRequest(request) {
  const cache = await caches.open(DATA_CACHE);

  try {
    const networkResponse = await fetchWithTimeout(request, API_NETWORK_TIMEOUT_MS);
    if (networkResponse.ok) {
      await cacheApiResponse(cache, request, networkResponse);
    }
    return networkResponse;
  } catch {
    const cached = await readFreshCachedApiResponse(cache, request);
    if (cached) {
      return cached;
    }
    return new Response(
      JSON.stringify({ error: "offline", message: "No recent cached snapshot available." }),
      {
        status: 503,
        headers: {
          "content-type": "application/json",
          "cache-control": "no-store",
        },
      },
    );
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== "GET") {
    return;
  }

  if (url.origin === self.location.origin && url.pathname.startsWith("/api/")) {
    event.respondWith(handleApiRequest(request));
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
