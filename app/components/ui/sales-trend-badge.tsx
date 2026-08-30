"use client"

import { TrendingUp, TrendingDown, Minus } from "lucide-react"

interface SalesTrendBadgeProps {
  pct: number | null
  tone: "up" | "down" | "flat"
  /** Label for what's being compared, e.g. "ticket sales", "vote sales". Defaults to "sales". */
  metric?: string
}

const TONE_STYLES: Record<SalesTrendBadgeProps["tone"], { bg: string; text: string; icon: typeof TrendingUp }> = {
  up:   { bg: "bg-emerald-50 border-emerald-200", text: "text-emerald-700", icon: TrendingUp },
  down: { bg: "bg-red-50 border-red-200",         text: "text-red-600",    icon: TrendingDown },
  flat: { bg: "bg-amber-50 border-amber-200",      text: "text-amber-600",  icon: Minus },
}

/**
 * Day-over-day sales trend indicator — green (rise), red (drop), or amber/
 * yellow (unchanged from yesterday). Used on the event-info Overview tab
 * (item 9 follow-up) and can be reused wherever a single event's/poll's
 * ticketSales/voteSales trend needs to show. See lib/sales-trend.ts for how
 * `pct`/`tone` are computed — from the admin/events/{eventId}/{date} (or
 * admin/votes/{pollId}/{date}) day-docs the Payouts tab already reads.
 */
export function SalesTrendBadge({ pct, tone, metric = "sales" }: SalesTrendBadgeProps) {
  const { bg, text, icon: Icon } = TONE_STYLES[tone]

  const label =
    tone === "flat"
      ? `No change in ${metric} since yesterday`
      : pct === null
      ? `New ${metric} today — none yesterday`
      : `${Math.abs(pct)}% ${tone === "up" ? "rise" : "drop"} since yesterday`

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${bg} ${text}`}>
      <Icon size={12} />
      {label}
    </span>
  )
}
