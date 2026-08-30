// app/components/nav-user-menu.tsx
"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { User, Puzzle, LogOut, ChevronRight } from "lucide-react"
import { dicebearAvatarUrl } from "@/lib/dicebear"

interface NavUserMenuProps {
  email?: string | null
  fullName?: string | null
  /** "rail" = collapsed/expanded desktop sidebar footer (popover opens upward).
   *  "mobile" = inline block at the bottom of the mobile drawer (no popover, rows shown flat). */
  variant?: "rail" | "mobile"
  /** Only used by variant="rail" — whether the sidebar is currently expanded (shows the name label). */
  expanded?: boolean
  onNavigate?: () => void
  onRequestLogout: () => void
}

/**
 * Avatar button (Spotix-rendered Dicebear image, seeded by the user's email)
 * that reveals "My Profile", "Integrations" and "Logout". Used at the footer
 * of both the desktop rail nav and the mobile drawer — see nav.tsx.
 */
export function NavUserMenu({ email, fullName, variant = "rail", expanded = false, onNavigate, onRequestLogout }: NavUserMenuProps) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const seed = email || fullName || "spotix-booker"
  const avatarUrl = dicebearAvatarUrl(seed, { size: 96 })

  useEffect(() => {
    if (variant !== "rail") return
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onClick)
    return () => document.removeEventListener("mousedown", onClick)
  }, [variant])

  const items = [
    { href: "/profile", label: "My Profile", icon: User },
    { href: "/integrations", label: "Integrations", icon: Puzzle },
  ]

  if (variant === "mobile") {
    return (
      <div className="space-y-0.5">
        <div className="flex items-center gap-3 px-3 py-2.5">
          <div className="relative w-8 h-8 rounded-full overflow-hidden ring-1 ring-[#6b2fa5]/20 bg-[#6b2fa5]/10 flex-shrink-0">
            <Image src={avatarUrl} alt={fullName || "Profile"} fill className="object-cover" unoptimized />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-800 truncate">{fullName || "Booker"}</p>
            <p className="text-xs text-slate-400 truncate">{email}</p>
          </div>
        </div>
        {items.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
          >
            <Icon size={17} strokeWidth={1.8} className="flex-shrink-0" />
            {label}
          </Link>
        ))}
        <button
          onClick={onRequestLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 transition-colors"
        >
          <LogOut size={17} strokeWidth={1.8} className="flex-shrink-0" />
          Sign out
        </button>
      </div>
    )
  }

  return (
    <div className="relative" ref={menuRef}>
      {open && (
        <div className="absolute bottom-[calc(100%+0.5rem)] left-0 w-56 bg-white rounded-xl border border-slate-100 shadow-xl shadow-black/[0.08] p-1.5 animate-in fade-in slide-in-from-bottom-1 duration-150">
          <div className="px-3 py-2 border-b border-slate-100 mb-1">
            <p className="text-sm font-semibold text-slate-800 truncate">{fullName || "Booker"}</p>
            <p className="text-xs text-slate-400 truncate">{email}</p>
          </div>
          {items.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => { setOpen(false); onNavigate?.() }}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
            >
              <Icon size={15} strokeWidth={1.8} className="flex-shrink-0" />
              <span className="flex-1">{label}</span>
              <ChevronRight size={13} className="opacity-40" />
            </Link>
          ))}
          <button
            onClick={() => { setOpen(false); onRequestLogout() }}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-red-500 hover:bg-red-50 transition-colors"
          >
            <LogOut size={15} strokeWidth={1.8} className="flex-shrink-0" />
            Logout
          </button>
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        title={fullName || "Account"}
        className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-slate-100 transition-colors"
      >
        <div className="relative w-8 h-8 rounded-full overflow-hidden ring-1 ring-[#6b2fa5]/20 bg-[#6b2fa5]/10 flex-shrink-0">
          <Image src={avatarUrl} alt={fullName || "Profile"} fill className="object-cover" unoptimized />
        </div>
        {expanded && (
          <span className="flex-1 min-w-0 text-left whitespace-nowrap overflow-hidden text-xs font-semibold text-slate-700">
            {fullName || "Account"}
          </span>
        )}
      </button>
    </div>
  )
}
