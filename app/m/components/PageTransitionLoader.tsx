"use client"

import Image from "next/image"
import { useEffect, useRef, useState } from "react"
import { usePathname } from "next/navigation"

/**
 * Shows /loader.gif briefly on every in-app route change within the PWA.
 * Skips the very first mount (that's the SplashScreen's job).
 */
export function PageTransitionLoader() {
  const pathname = usePathname()
  const [active, setActive] = useState(false)
  const isFirstRender = useRef(true)

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    setActive(true)
    const t = setTimeout(() => setActive(false), 450)
    return () => clearTimeout(t)
  }, [pathname])

  return (
    <div className="pwa-page-loader" data-active={active} aria-hidden={!active}>
      <div className="relative h-16 w-16">
        <Image
          src="/loader.gif"
          alt="Loading"
          fill
          className="object-contain"
          unoptimized
        />
      </div>
    </div>
  )
}
