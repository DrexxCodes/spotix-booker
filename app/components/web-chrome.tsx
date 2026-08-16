"use client"

import { usePathname } from "next/navigation"
import { Nav } from "./nav"
import { Footer } from "./footer"


export function WebChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  // since the PWA starts with /m, we can use that to determine whether to show the nav/footer
  const isPwaRoute = pathname?.startsWith("/m")

  return (
    <>
      {!isPwaRoute && <Nav />}
      {children}
      {!isPwaRoute && <Footer />}
    </>
  )
}
