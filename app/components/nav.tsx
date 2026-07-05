"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import {
  LayoutDashboard,
  PlusCircle,
  CalendarDays,
  User,
  BarChart2,
  ShoppingBag,
  BadgeCheck,
  Vote,
  LogIn,
  LogOut,
  ChevronRight,
  X,
  Menu,
} from "lucide-react"
import { logout } from "@/lib/auth-client"
import { useAuth } from "@/hooks/useAuth"
import { LogoutDialog } from "@/components/logout-dialog"

const NAV_ITEMS = [
  { href: "/dashboard",    label: "Dashboard",    icon: LayoutDashboard },
  { href: "/create-event", label: "Create Event", icon: PlusCircle      },
  { href: "/events",       label: "Events",       icon: CalendarDays    },
  { href: "/polls",        label: "Polls",        icon: Vote            },
  { href: "/profile",      label: "Profile",      icon: User            },
  { href: "/reports",      label: "Reports",      icon: BarChart2       },
  { href: "/listings",     label: "My Store",     icon: ShoppingBag     },
  { href: "/verification", label: "Get Verified", icon: BadgeCheck      },
]

export function Nav() {
  const pathname = usePathname()
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen]             = useState(false)
  const [sidebarExpanded, setSidebarExpanded]     = useState(false)
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false)
  const { user, loading } = useAuth()
  const sidebarRef = useRef<HTMLDivElement>(null)

  // Close sidebar on outside click (mobile)
  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (sidebarOpen && sidebarRef.current && !sidebarRef.current.contains(e.target as Node)) {
        setSidebarOpen(false)
      }
    }
    document.addEventListener("mousedown", onOutside)
    return () => document.removeEventListener("mousedown", onOutside)
  }, [sidebarOpen])

  // Lock body scroll when mobile sidebar is open
  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? "hidden" : ""
    return () => { document.body.style.overflow = "" }
  }, [sidebarOpen])

  const handleLogoutComplete = async () => {
    setIsLogoutDialogOpen(false)
    setSidebarOpen(false)
    logout()
    router.push("/login")
  }

  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === href : pathname.startsWith(href)

  return (
    <>
      {/* ─── Top bar ─────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 h-14 flex items-center border-b border-slate-100 bg-white/90 backdrop-blur-xl px-4 sm:px-6 lg:px-8 shadow-sm shadow-black/[0.04]">
        <div className="flex w-full items-center justify-between max-w-screen-2xl mx-auto">

          {/* Logo */}
          <Link
            href={user ? "/dashboard" : "/login"}
            className="flex items-center gap-2.5 group"
          >
            <div className="relative w-8 h-8 rounded-lg overflow-hidden ring-1 ring-[#6b2fa5]/20 group-hover:ring-[#6b2fa5]/50 transition-all duration-200 group-hover:scale-105">
              <Image src="/logo.png" alt="Spotix" fill className="object-cover" priority />
            </div>
            <span className="hidden sm:block text-sm font-semibold text-slate-800 tracking-tight">
              Spotix <span className="text-[#6b2fa5]">Booker</span>
            </span>
          </Link>

          {/* Desktop icon rail — hidden when sidebar is expanded */}
          {!loading && user && (
            <nav
              className={`hidden md:flex items-center gap-0.5 transition-all duration-300 ${
                sidebarExpanded ? "opacity-0 pointer-events-none" : "opacity-100"
              }`}
              aria-label="Primary navigation"
            >
              {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
                const active = isActive(href)
                return (
                  <Link
                    key={href}
                    href={href}
                    title={label}
                    className={`
                      relative flex items-center gap-0 px-2.5 py-2 rounded-lg text-sm font-medium
                      overflow-hidden transition-all duration-200 group
                      hover:gap-1.5 hover:px-3
                      ${active
                        ? "text-[#6b2fa5] bg-[#6b2fa5]/8"
                        : "text-slate-400 hover:text-slate-800 hover:bg-slate-100"
                      }
                    `}
                  >
                    <Icon size={17} strokeWidth={active ? 2.2 : 1.8} className="flex-shrink-0" />
                    <span className={`
                      whitespace-nowrap overflow-hidden text-xs font-semibold
                      transition-all duration-200 ease-out
                      max-w-0 opacity-0
                      group-hover:max-w-[96px] group-hover:opacity-100
                    `}>
                      {label}
                    </span>
                    {active && (
                      <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#6b2fa5]" />
                    )}
                  </Link>
                )
              })}

              <div className="w-px h-5 bg-slate-200 mx-1" />

              {/* Logout icon button */}
              <button
                onClick={() => setIsLogoutDialogOpen(true)}
                title="Sign out"
                className="flex items-center gap-0 px-2.5 py-2 rounded-lg text-sm font-medium text-slate-400
                  overflow-hidden transition-all duration-200 group
                  hover:gap-1.5 hover:px-3 hover:text-red-500 hover:bg-red-50"
              >
                <LogOut size={17} strokeWidth={1.8} className="flex-shrink-0" />
                <span className="whitespace-nowrap overflow-hidden text-xs font-semibold max-w-0 opacity-0 transition-all duration-200 ease-out group-hover:max-w-[60px] group-hover:opacity-100">
                  Sign out
                </span>
              </button>
            </nav>
          )}

          {/* Right side */}
          <div className="flex items-center gap-2">
            {!loading && !user && (
              <Link
                href="/login"
                className="flex items-center gap-1.5 rounded-lg bg-[#6b2fa5] px-3.5 py-2 text-sm font-semibold text-white hover:bg-[#5a2589] transition-colors shadow-sm"
              >
                <LogIn size={15} />
                Sign in
              </Link>
            )}

            {/* Mobile hamburger */}
            {!loading && user && (
              <button
                onClick={() => setSidebarOpen(true)}
                className="md:hidden flex items-center justify-center w-9 h-9 rounded-lg text-slate-500 hover:text-[#6b2fa5] hover:bg-[#6b2fa5]/8 transition-colors"
                aria-label="Open navigation"
              >
                <Menu size={20} />
              </button>
            )}

            {/* Desktop: expand sidebar toggle */}
            {!loading && user && (
              <button
                onClick={() => setSidebarExpanded((v) => !v)}
                title={sidebarExpanded ? "Collapse menu" : "Expand menu"}
                className="hidden md:flex items-center justify-center w-8 h-8 rounded-lg text-slate-400
                  hover:text-[#6b2fa5] hover:bg-[#6b2fa5]/8 transition-colors"
                aria-label={sidebarExpanded ? "Collapse menu" : "Expand menu"}
              >
                <ChevronRight
                  size={16}
                  className={`transition-transform duration-300 ${sidebarExpanded ? "rotate-180" : ""}`}
                />
              </button>
            )}
          </div>

        </div>
      </header>

      {/* ─── Desktop expanded sidebar (slides out from right of header) ──── */}
      {!loading && user && (
        <aside className={`
          hidden md:flex flex-col
          fixed top-14 right-0 z-30 h-[calc(100vh-3.5rem)]
          bg-white border-l border-slate-100 shadow-xl shadow-black/[0.06]
          transition-all duration-300 ease-out overflow-hidden
          ${sidebarExpanded ? "w-56 opacity-100" : "w-0 opacity-0 pointer-events-none"}
        `}>
          <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
            {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
              const active = isActive(href)
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setSidebarExpanded(false)}
                  className={`
                    flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
                    transition-all duration-150 whitespace-nowrap
                    ${active
                      ? "bg-[#6b2fa5] text-white shadow-sm shadow-[#6b2fa5]/20"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }
                  `}
                >
                  <Icon size={16} strokeWidth={active ? 2.2 : 1.8} className="flex-shrink-0" />
                  {label}
                  {active && <ChevronRight size={13} className="ml-auto opacity-60" />}
                </Link>
              )
            })}
          </nav>
          <div className="px-3 py-4 border-t border-slate-100 flex-shrink-0">
            <button
              onClick={() => { setSidebarExpanded(false); setIsLogoutDialogOpen(true) }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 transition-colors whitespace-nowrap"
            >
              <LogOut size={16} strokeWidth={1.8} className="flex-shrink-0" />
              Sign out
            </button>
          </div>
        </aside>
      )}

      {/* ─── Mobile sidebar backdrop ─────────────────────────────────────── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] md:hidden animate-in fade-in duration-200"
          aria-hidden="true"
        />
      )}

      {/* ─── Mobile sidebar (slides in from right) ───────────────────────── */}
      <aside
        ref={sidebarRef}
        className={`
          fixed top-0 right-0 z-50 h-full w-72 bg-white shadow-2xl shadow-black/20
          flex flex-col
          transform transition-transform duration-300 ease-out md:hidden
          ${sidebarOpen ? "translate-x-0" : "translate-x-full"}
        `}
      >
        {/* Sidebar header */}
        <div className="flex items-center justify-between px-5 h-14 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="relative w-7 h-7 rounded-md overflow-hidden ring-1 ring-[#6b2fa5]/20">
              <Image src="/logo.png" alt="Spotix" fill className="object-cover" />
            </div>
            <span className="text-sm font-semibold text-slate-800 tracking-tight">
              Spotix <span className="text-[#6b2fa5]">Booker</span>
            </span>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            aria-label="Close navigation"
          >
            <X size={18} />
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = isActive(href)
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setSidebarOpen(false)}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
                  transition-all duration-150
                  ${active
                    ? "bg-[#6b2fa5] text-white shadow-sm shadow-[#6b2fa5]/25"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }
                `}
              >
                <Icon size={17} strokeWidth={active ? 2.2 : 1.8} className="flex-shrink-0" />
                <span className="flex-1">{label}</span>
                {active && <ChevronRight size={14} className="opacity-60 flex-shrink-0" />}
              </Link>
            )
          })}
        </nav>

        {/* Sidebar footer */}
        <div className="px-3 py-4 border-t border-slate-100 flex-shrink-0">
          <button
            onClick={() => { setSidebarOpen(false); setIsLogoutDialogOpen(true) }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 transition-colors"
          >
            <LogOut size={17} strokeWidth={1.8} className="flex-shrink-0" />
            Sign out
          </button>
        </div>
      </aside>

      <LogoutDialog
        isOpen={isLogoutDialogOpen}
        onClose={() => setIsLogoutDialogOpen(false)}
        onLogoutComplete={handleLogoutComplete}
      />
    </>
  )
}
