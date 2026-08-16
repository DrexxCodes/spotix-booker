"use client"

import { usePathname } from "next/navigation"
import { SplashScreen } from "./SplashScreen"
import { PageTransitionLoader } from "./PageTransitionLoader"
import { PwaHeader } from "./PwaHeader"
import { PwaNav } from "./PwaNav"
import { PwaServiceWorker } from "./PwaServiceWorker"
import { PwaBackgroundOrbs } from "./PwaBackgroundOrbs"

export function PwaShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isAuthPage = pathname === "/m/login"

  return (
    <div className="pwa-shell">
      <PwaBackgroundOrbs />
      <SplashScreen />
      <PageTransitionLoader />
      <PwaServiceWorker />

      {!isAuthPage && <PwaNav />}

      <div className={`relative z-10 ${!isAuthPage ? "pwa-content-area" : ""}`}>
        {!isAuthPage && <PwaHeader />}

        <main
          className={`relative z-10 mx-auto min-h-[100dvh] w-full ${
            isAuthPage
              ? "max-w-md"
              : "max-w-screen-2xl px-4 pb-24 pt-4 sm:px-6 lg:px-10 lg:pb-10"
          }`}
        >
          {children}
        </main>
      </div>
    </div>
  )
}
