"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import {
  Home,
  CalendarDays,
  Plus,
  Vote,
  BarChart2,
  CalendarPlus,
  Trophy,
  ListChecks,
} from "lucide-react"

const NAV_ITEMS = [
  { href: "/m/dashboard", label: "Home", icon: Home },
  { href: "/m/events", label: "Events", icon: CalendarDays },
  // Create is the center action button, handled separately below.
  { href: "/m/polls", label: "Polls", icon: Vote },
  { href: "/m/report", label: "Report", icon: BarChart2 },
]

const CREATE_OPTIONS = [
  {
    key: "event",
    label: "Event",
    icon: CalendarPlus,
    href: "/m/create/event",
    side: "left" as const,
  },
  {
    key: "nomination",
    label: "Nomination",
    icon: ListChecks,
    href: "/m/create/nomination",
    side: "center" as const,
  },
  {
    key: "poll",
    label: "Poll",
    icon: Trophy,
    href: "/m/create/poll",
    side: "right" as const,
  },
]

export function PwaBottomNav() {
  const pathname = usePathname()
  const router = useRouter()
  const [fanOpen, setFanOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setFanOpen(false)
      }
    }
    document.addEventListener("mousedown", onClick)
    return () => document.removeEventListener("mousedown", onClick)
  }, [])

  // Close the fan automatically on route change.
  useEffect(() => {
    setFanOpen(false)
  }, [pathname])

  const isCreateActive = pathname?.startsWith("/m/create")

  return (
    <nav
      ref={wrapRef}
      className="pwa-glass-nav fixed inset-x-0 bottom-0 z-40"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="relative mx-auto flex max-w-md items-stretch">
        {CREATE_OPTIONS.map((opt) => {
          const Icon = opt.icon
          return (
            <button
              key={opt.key}
              data-open={fanOpen}
              data-side={opt.side}
              className="pwa-fan-item"
              onClick={() => {
                setFanOpen(false)
                router.push(opt.href)
              }}
            >
              <span className="pwa-fan-bubble pwa-glass-strong text-white">
                <Icon size={18} />
              </span>
              <span className="rounded-full bg-black/40 px-2 py-0.5 text-[10px] font-medium text-white/90">
                {opt.label}
              </span>
            </button>
          )
        })}

        {NAV_ITEMS.slice(0, 2).map((item) => {
          const active = pathname === item.href || pathname?.startsWith(item.href + "/")
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              data-active={active}
              className="pwa-nav-item h-16"
            >
              <span className="pwa-nav-icon-wrap">
                <Icon size={19} strokeWidth={active ? 2.4 : 2} />
              </span>
              <span className="pwa-nav-label">{item.label}</span>
            </Link>
          )
        })}

        <button
          data-active={isCreateActive}
          className="pwa-nav-item h-16"
          aria-label="Create"
          onClick={() => setFanOpen((v) => !v)}
        >
          <span className="pwa-create-btn" data-open={fanOpen}>
            <Plus size={22} className="text-white" strokeWidth={2.4} />
          </span>
          <span className="pwa-nav-label opacity-0">Create</span>
        </button>

        {NAV_ITEMS.slice(2).map((item) => {
          const active = pathname === item.href || pathname?.startsWith(item.href + "/")
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              data-active={active}
              className="pwa-nav-item h-16"
            >
              <span className="pwa-nav-icon-wrap">
                <Icon size={19} strokeWidth={active ? 2.4 : 2} />
              </span>
              <span className="pwa-nav-label">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
