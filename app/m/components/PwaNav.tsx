"use client"

import Link from "next/link"
import Image from "next/image"
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
  { key: "home", href: "/m/dashboard", label: "Home", icon: Home },
  { key: "events", href: "/m/events", label: "Events", icon: CalendarDays },
  // "create" is the center action button, spliced in between — handled separately.
  { key: "polls", href: "/m/polls", label: "Polls", icon: Vote },
  { key: "report", href: "/m/report", label: "Report", icon: BarChart2 },
]

const CREATE_OPTIONS = [
  { key: "event", label: "Event", icon: CalendarPlus, href: "/m/create/event", side: "left" as const },
  { key: "nomination", label: "Nomination", icon: ListChecks, href: "/m/create/nomination", side: "center" as const },
  { key: "poll", label: "Poll", icon: Trophy, href: "/m/create/poll", side: "right" as const },
]

/**
 * Which nav item should be "active" for a given pathname.
 * Companion pages (event-info under /m/events/[id], poll sub-pages under
 * /m/polls/[id]/edit|settings|payout) point back at their parent tab
 * rather than lighting up nothing or a phantom item.
 */
function activeKeyFor(pathname: string | null): string {
  if (!pathname) return "home"
  if (pathname.startsWith("/m/events")) return "events"
  if (pathname.startsWith("/m/polls")) return "polls"
  if (pathname.startsWith("/m/report")) return "report"
  if (pathname.startsWith("/m/create")) return "create"
  return "home"
}

export function PwaNav() {
  const pathname = usePathname()
  const router = useRouter()
  const [fanOpen, setFanOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const railWrapRef = useRef<HTMLDivElement>(null)

  const activeKey = activeKeyFor(pathname)

  useEffect(() => {
    function onClick(e: MouseEvent) {
      const inBottom = wrapRef.current?.contains(e.target as Node)
      const inRail = railWrapRef.current?.contains(e.target as Node)
      if (!inBottom && !inRail) setFanOpen(false)
    }
    document.addEventListener("mousedown", onClick)
    return () => document.removeEventListener("mousedown", onClick)
  }, [])

  useEffect(() => {
    setFanOpen(false)
  }, [pathname])

  function goTo(href: string) {
    setFanOpen(false)
    router.push(href)
  }

  return (
    <>
      {/* ---------------- Mobile / tablet: bottom bar ---------------- */}
      <nav
        ref={wrapRef}
        className="pwa-glass-nav fixed inset-x-0 bottom-0 z-40 lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="relative mx-auto flex max-w-xl items-stretch px-1">
          {CREATE_OPTIONS.map((opt) => {
            const Icon = opt.icon
            return (
              <button
                key={opt.key}
                data-open={fanOpen}
                data-side={opt.side}
                className="pwa-fan-item"
                onClick={() => goTo(opt.href)}
              >
                <span className="pwa-fan-bubble pwa-glass-strong">
                  <Icon size={17} />
                </span>
                <span className="pwa-fan-label">{opt.label}</span>
              </button>
            )
          })}

          {NAV_ITEMS.slice(0, 2).map((item) => {
            const active = activeKey === item.key
            const Icon = item.icon
            return (
              <Link
                key={item.key}
                href={item.href}
                data-active={active}
                className="pwa-nav-item pwa-nav-item--bottom h-16"
              >
                <span className="pwa-nav-pointer--bottom" />
                <span className="pwa-nav-icon-wrap">
                  <Icon size={19} strokeWidth={active ? 2.4 : 2} />
                </span>
                <span className="pwa-nav-label">{item.label}</span>
              </Link>
            )
          })}

          <div className="flex flex-1 flex-col items-center justify-center gap-0.5">
            <button
              data-active={activeKey === "create"}
              className="pwa-nav-item pwa-nav-item--bottom h-16 w-full items-center"
              aria-label="Create"
              onClick={() => setFanOpen((v) => !v)}
            >
              <span className="pwa-create-btn" data-open={fanOpen}>
                <Plus size={20} className="text-white" strokeWidth={2.4} />
              </span>
            </button>
          </div>

          {NAV_ITEMS.slice(2).map((item) => {
            const active = activeKey === item.key
            const Icon = item.icon
            return (
              <Link
                key={item.key}
                href={item.href}
                data-active={active}
                className="pwa-nav-item pwa-nav-item--bottom h-16"
              >
                <span className="pwa-nav-pointer--bottom" />
                <span className="pwa-nav-icon-wrap">
                  <Icon size={19} strokeWidth={active ? 2.4 : 2} />
                </span>
                <span className="pwa-nav-label">{item.label}</span>
              </Link>
            )
          })}
        </div>
      </nav>

      {/* ---------------- Desktop / large screens: side rail ---------------- */}
      <nav
        ref={railWrapRef}
        className="pwa-glass-nav fixed inset-y-0 left-0 z-40 hidden w-[var(--pwa-rail-w-lg)] flex-col gap-1 border-r border-[rgba(107,47,165,0.1)] px-3 py-6 lg:flex"
      >
        <Link href="/m/dashboard" className="mb-6 flex items-center gap-2 px-2">
          <div className="relative h-8 w-8 shrink-0">
            <Image src="/logo-full.png" alt="Spotix Booker" fill className="object-contain" unoptimized />
          </div>
          <span className="text-sm font-semibold tracking-tight text-[#1e1330]">
            Spotix Booker
          </span>
        </Link>

        {NAV_ITEMS.slice(0, 2).map((item) => {
          const active = activeKey === item.key
          const Icon = item.icon
          return (
            <Link
              key={item.key}
              href={item.href}
              data-active={active}
              className="pwa-nav-item pwa-nav-item--rail"
            >
              <span className="pwa-nav-pointer--rail" />
              <span className="pwa-nav-icon-wrap">
                <Icon size={18} strokeWidth={active ? 2.4 : 2} />
              </span>
              <span className="pwa-nav-label">{item.label}</span>
            </Link>
          )
        })}

        <div className="relative my-1">
          <button
            data-active={activeKey === "create"}
            className="pwa-nav-item pwa-nav-item--rail w-full"
            onClick={() => setFanOpen((v) => !v)}
          >
            <span className="pwa-nav-pointer--rail" />
            <span className="pwa-create-btn pwa-create-btn--rail" data-open={fanOpen} style={{ width: "2.1rem", height: "2.1rem" }}>
              <Plus size={16} className="text-white" strokeWidth={2.4} />
            </span>
            <span className="pwa-nav-label">Create</span>
          </button>

          {CREATE_OPTIONS.map((opt) => {
            const Icon = opt.icon
            return (
              <button
                key={opt.key}
                data-open={fanOpen}
                data-side={opt.side}
                className="pwa-fan-item pwa-fan-item--rail"
                onClick={() => goTo(opt.href)}
              >
                <span className="pwa-fan-bubble pwa-glass-strong">
                  <Icon size={16} />
                </span>
                <span className="pwa-fan-label">{opt.label}</span>
              </button>
            )
          })}
        </div>

        {NAV_ITEMS.slice(2).map((item) => {
          const active = activeKey === item.key
          const Icon = item.icon
          return (
            <Link
              key={item.key}
              href={item.href}
              data-active={active}
              className="pwa-nav-item pwa-nav-item--rail"
            >
              <span className="pwa-nav-pointer--rail" />
              <span className="pwa-nav-icon-wrap">
                <Icon size={18} strokeWidth={active ? 2.4 : 2} />
              </span>
              <span className="pwa-nav-label">{item.label}</span>
            </Link>
          )
        })}
      </nav>
    </>
  )
}
