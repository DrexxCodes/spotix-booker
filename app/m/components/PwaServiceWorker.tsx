"use client"

import { useEffect } from "react"

/**
 * Registers /pwa-sw.js scoped to /m/ only, so it never touches or caches
 * the main web app. Safe to no-op silently if unsupported/blocked.
 */
export function PwaServiceWorker() {
  useEffect(() => {
    if (typeof window === "undefined") return
    if (!("serviceWorker" in navigator)) return

    navigator.serviceWorker
      .register("/pwa-sw.js", { scope: "/m/" })
      .catch((err) => {
        console.warn("[spotix-pwa] service worker registration failed:", err)
      })
  }, [])

  return null
}
