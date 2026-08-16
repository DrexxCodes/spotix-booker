"use client"

import Image from "next/image"
import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { ChevronDown, LogOut, User as UserIcon } from "lucide-react"
import { useAuth } from "@/hooks/useAuth"
import { dicebearAvatarUrl } from "@/lib/dicebear"
import { logout } from "@/lib/auth-client"

export function PwaHeader() {
  const { user } = useAuth()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", onClick)
    return () => document.removeEventListener("mousedown", onClick)
  }, [])

  const seed = user?.email || user?.fullName || "spotix-booker"
  const avatarUrl = dicebearAvatarUrl(seed, { size: 96 })

  async function handleSignOut() {
    setSigningOut(true)
    try {
      await logout()
    } finally {
      router.push("/m/login")
    }
  }

  return (
    <header className="pwa-glass-header sticky top-0 z-30 flex items-center justify-between px-4 py-3 sm:px-6 lg:px-10">
      <Link href="/m/dashboard" className="flex items-center gap-2 lg:hidden">
        <div className="relative h-8 w-8 shrink-0">
          <Image src="/logo-full.png" alt="Spotix Booker" fill className="object-contain" unoptimized />
        </div>
        <span className="text-sm font-semibold tracking-tight text-[#1e1330]">
          Spotix Booker
        </span>
      </Link>

      {/* On lg+ the rail nav owns the left edge, so give the header a title
          area instead of leaving an empty gap next to the avatar. */}
      <span className="hidden text-sm font-semibold text-[#1e1330]/70 lg:block">
        Booker Dashboard
      </span>

      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1.5 rounded-full pwa-glass px-1.5 py-1.5 pr-2.5 active:scale-95 transition-transform"
        >
          <div className="relative h-7 w-7 overflow-hidden rounded-full bg-[#6b2fa5]/10">
            <Image src={avatarUrl} alt={user?.fullName || "Profile"} fill className="object-cover" unoptimized />
          </div>
          <ChevronDown
            size={14}
            className={`text-[#1e1330]/40 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>

        {open && (
          <div className="pwa-glass-strong pwa-dropdown-enter absolute right-0 top-[calc(100%+0.5rem)] w-48 overflow-hidden rounded-2xl p-1.5">
            <div className="px-3 py-2">
              <p className="truncate text-xs font-semibold text-[#1e1330]">
                {user?.fullName || "Booker"}
              </p>
              <p className="truncate text-[11px] text-[#1e1330]/50">{user?.email}</p>
            </div>
            <div className="my-1 h-px bg-[#6b2fa5]/10" />
            <Link
              href="/m/profile"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-[#1e1330]/85 hover:bg-[#6b2fa5]/8 transition-colors"
            >
              <UserIcon size={15} />
              Profile
            </Link>
            <button
              onClick={handleSignOut}
              disabled={signingOut}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
            >
              <LogOut size={15} />
              {signingOut ? "Signing out..." : "Sign out"}
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
