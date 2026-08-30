"use client"

import { usePathname, useRouter } from "next/navigation"
import { ShieldAlert, ChevronRight } from "lucide-react"
import { useBVTStatus } from "@/hooks/useBVTStatus"

/**
 * Full-width KYC reminder shown at the top of the app for any booker who
 * hasn't completed BVT verification yet — checked once per app load via
 * useBVTStatus(). Clicking it goes straight to /verification.
 *
 * Mounted globally in web-chrome.tsx (skipped on /verification itself,
 * signed-out routes, and the PWA shell, which has its own equivalent).
 */
export function KycBanner() {
  const router = useRouter()
  const pathname = usePathname()
  const { isVerified, loading, checked } = useBVTStatus()

  if (loading || !checked || isVerified) return null
  if (pathname?.startsWith("/verification") || pathname?.startsWith("/login") || pathname?.startsWith("/m")) return null

  return (
    <button
      onClick={() => router.push("/verification")}
      className="w-full flex items-center justify-center gap-2 bg-amber-50 border-b border-amber-200 px-4 py-2 text-xs sm:text-sm font-medium text-amber-800 hover:bg-amber-100 transition-colors text-center"
    >
      <ShieldAlert size={15} className="flex-shrink-0" />
      <span>Complete KYC details in the verification page to be able to access withdrawals.</span>
      <ChevronRight size={14} className="flex-shrink-0 opacity-60" />
    </button>
  )
}
