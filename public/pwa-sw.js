// Spotix Booker PWA service worker — scoped to /m/ only (see
// PwaServiceWorker.tsx registration with { scope: "/m/" }).
// Never intercepts /api/* — all data stays live/network-only.

const CACHE_NAME = "spotix-booker-pwa-v1"
const APP_SHELL = [
  "/m/dashboard",
  "/pwa-manifest.json",
  "/logo-full.png",
  "/loader.gif",
]

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL).catch(() => {}))
  )
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      )
  )
  self.clients.claim()
})

self.addEventListener("fetch", (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Never cache API calls or non-GET requests — data must always be live.
  if (url.pathname.startsWith("/api/") || request.method !== "GET") {
    return
  }

  // Only handle same-origin requests inside the PWA scope.
  if (url.origin !== self.location.origin || !url.pathname.startsWith("/m")) {
    if (!APP_SHELL.includes(url.pathname)) return
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        const clone = response.clone()
        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
        return response
      })
      .catch(() => caches.match(request).then((cached) => cached || caches.match("/m/dashboard")))
  )
})
