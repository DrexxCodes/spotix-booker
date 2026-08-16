"use client"

import { useProtectedPage } from "@/hooks/useProtectedPage"
import { useAuth } from "@/hooks/useAuth"
import { dicebearAvatarUrl } from "@/lib/dicebear"
import { PwaSkelLine } from "../components/PwaSkeleton"
import Image from "next/image"

export default function PwaProfilePage() {
  useProtectedPage()
  const { user, loading } = useAuth()
  const avatarUrl = dicebearAvatarUrl(user?.email || "spotix-booker", { size: 160 })

  return (
    <div className="mx-auto max-w-xl space-y-4 lg:max-w-2xl">
      <div className="pwa-glass-strong flex flex-col items-center gap-3 rounded-3xl p-6 text-center sm:p-8">
        <div className="relative h-20 w-20 overflow-hidden rounded-full bg-[#6b2fa5]/10">
          <Image src={avatarUrl} alt="Profile" fill className="object-cover" unoptimized />
        </div>
        {loading ? (
          <PwaSkelLine className="w-32" />
        ) : (
          <>
            <p className="text-base font-semibold text-[#1e1330]">{user?.fullName}</p>
            <p className="text-xs text-[#1e1330]/50">{user?.email}</p>
          </>
        )}
      </div>

      <div className="pwa-glass rounded-2xl p-4 text-center">
        <p className="text-xs text-[#1e1330]/40">Spotix Mobile PWA v1.0.0</p>
      </div>

      <div className="pwa-glass rounded-2xl p-4">
        <p className="text-sm text-[#1e1330]/60">
          Full profile (stats, payout methods, collaborations, Telegram
          connect) arrives in Phase 6 — same <code>/api/profile/*</code>{" "}
          endpoints as the web app.
        </p>
      </div>
    </div>
  )
}
