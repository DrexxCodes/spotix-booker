"use client"

import Image from "next/image"
import { useEffect, useState } from "react"
import { useAuth } from "@/hooks/useAuth"

/**
 * Blank-background splash screen for the Spotix Booker PWA.
 *
 * Shown on cold load until:
 *   1. AuthProvider has finished its first init check, AND
 *   2. a minimum display time has elapsed (avoids a jarring flash on fast
 *      connections — matches the feel of native app splash screens).
 *
 * References /logo-full.png — drop that asset into /public for it to render.
 */
export function SplashScreen() {
  const { loading } = useAuth()
  const [minTimeElapsed, setMinTimeElapsed] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setMinTimeElapsed(true), 900)
    return () => clearTimeout(t)
  }, [])

  const hidden = !loading && minTimeElapsed

  return (
    <div className="pwa-splash" data-hidden={hidden}>
      <div className="relative h-20 w-56">
        <Image
          src="/logo-full.png"
          alt="Spotix Booker"
          fill
          className="object-contain"
          priority
          unoptimized
        />
      </div>
      <p className="text-sm font-medium tracking-wide text-[#1e1330]/60">
        Spotix Booker Mobile
      </p>
      <div className="pwa-splash-spinner" />
    </div>
  )
}
