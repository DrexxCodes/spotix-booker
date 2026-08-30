"use client"

import { usePathname } from "next/navigation"
import { Nav } from "./nav"
import { KycBanner } from "./kyc-banner"

export function WebChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  // since the PWA starts with /m, we can use that to determine whether to show the nav
  const isPwaRoute = pathname?.startsWith("/m")

  return (
    <>
      {!isPwaRoute && <KycBanner />}
      {!isPwaRoute && <Nav />}
      {/* md:pl-16 keeps page content clear of the fixed left icon-rail (see
          NAV_RAIL_WIDTH in nav.tsx). The rail expands as an overlay on top of
          this padding rather than pushing it, so no per-page changes needed. */}
      <div className={!isPwaRoute ? "md:pl-16" : ""}>{children}</div>
    </>
  )
}
