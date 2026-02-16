import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: false,
      manifest: false,
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        navigateFallback: "/index.html",
        runtimeCaching: [
          {
            urlPattern: ({ request, sameOrigin, url }) =>
              sameOrigin && request.method === "GET" && url.pathname.startsWith("/api/"),
            handler: "NetworkFirst",
            options: {
              cacheName: "unraid-pwa-data",
              networkTimeoutSeconds: 8,
              cacheableResponse: {
                statuses: [200],
              },
              expiration: {
                maxEntries: 80,
                maxAgeSeconds: 2 * 60,
              },
            },
          },
          {
            urlPattern: ({ request, sameOrigin }) =>
              sameOrigin && request.mode === "navigate",
            handler: "NetworkFirst",
            options: {
              cacheName: "unraid-pwa-pages",
              networkTimeoutSeconds: 5,
              cacheableResponse: {
                statuses: [200],
              },
            },
          },
          {
            urlPattern: ({ request, sameOrigin }) =>
              sameOrigin && ["script", "style", "worker"].includes(request.destination),
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "unraid-pwa-assets",
            },
          },
          {
            urlPattern: ({ request, sameOrigin }) =>
              sameOrigin && request.destination === "image",
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "unraid-pwa-images",
              expiration: {
                maxEntries: 120,
                maxAgeSeconds: 30 * 24 * 60 * 60,
              },
            },
          },
        ],
      },
    }),
  ],
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
      "/health": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
});
