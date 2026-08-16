"use client"

import { useEffect, useState } from "react"
import { getTimeBasedGreeting, getGreetingAddon } from "@/lib/greeting-utils"
import { RefreshCw } from "lucide-react"

export function PwaDashboardGreeting({
  userName,
  onRefresh,
  isRefreshing,
  lastRefreshed,
}: {
  userName: string
  onRefresh: () => void
  isRefreshing: boolean
  lastRefreshed: Date | null
}) {
  const [now, setNow] = useState(new Date())
  const greeting = getTimeBasedGreeting()
  const addon = getGreetingAddon()
  const hour = now.getHours()

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const timeStr = now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  })
  const dateStr = now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  })

  // Same time-of-day gradient logic as the web dashboard header.
  const gradientClass =
    hour >= 5 && hour < 12
      ? "from-[#5a2595] to-[#7c3aed]"
      : hour >= 12 && hour < 18
      ? "from-[#6b2fa5] to-[#7c3aed]"
      : "from-[#3d1578] to-[#6b2fa5]"

  return (
    <div
      className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${gradientClass} p-5 text-white shadow-lg sm:p-7`}
    >
      <div className="absolute -top-14 -right-14 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
      <div className="absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-white/5 blur-2xl" />

      <div className="relative z-10 flex items-start justify-between gap-4">
        <div className="flex-1 space-y-1.5">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur-sm">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
            Dashboard Active
          </div>
          <div>
            <p className="text-sm font-medium text-white/70">{greeting},</p>
            <h1 className="mt-0.5 text-2xl font-black tracking-tight sm:text-3xl">
              {userName} 👋
            </h1>
          </div>
          <p className="max-w-sm text-sm leading-relaxed text-white/80">{addon}</p>
        </div>

        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          aria-label="Refresh dashboard"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm transition-transform active:scale-90 disabled:opacity-60"
        >
          <RefreshCw size={15} className={isRefreshing ? "animate-spin" : ""} />
        </button>
      </div>

      <div className="relative z-10 mt-5 flex items-center justify-between border-t border-white/15 pt-4">
        <div>
          <p className="text-xl font-bold tabular-nums tracking-wider sm:text-2xl">{timeStr}</p>
          <p className="mt-0.5 text-xs text-white/60">{dateStr}</p>
        </div>
        {lastRefreshed && (
          <p className="hidden text-xs text-white/40 sm:block">
            Updated {lastRefreshed.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </p>
        )}
      </div>
    </div>
  )
}
