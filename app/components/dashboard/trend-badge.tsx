"use client"

import { ArrowUp, ArrowDown, Minus } from "lucide-react"

/**
 * "±x%" pill shown next to a dashboard section header (Events, Polls) —
 * day-over-day ticketSales/voteSales trend (today vs yesterday), read from
 * the admin/events/{eventId}/{date} and admin/votes/{pollId}/{date} day-docs
 * — the same collection the Payouts tab already reads — summed across all
 * of the booker's events/polls. See lib/sales-trend.ts (server) and item 9
 * of the UI renovation.
 *
 * Green = rise, red = drop, yellow/amber = unchanged from yesterday.
 * `tone` is optional for backward compatibility — if omitted it's derived
 * from the sign of `pct` (flat rendered as neutral in that fallback path).
 */
export function TrendBadge({ pct, tone }: { pct: number | null; tone?: "up" | "down" | "flat" }) {
  const resolvedTone: "up" | "down" | "flat" | null =
    tone ?? (pct === null ? null : pct > 0 ? "up" : pct < 0 ? "down" : "flat")

  if (resolvedTone === null) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-400">
        <Minus size={11} /> New
      </span>
    )
  }

  const toneStyles: Record<"up" | "down" | "flat", string> = {
    up:   "bg-emerald-50 text-emerald-700",
    down: "bg-red-50 text-red-600",
    flat: "bg-amber-50 text-amber-600",
  }
  const Icon = resolvedTone === "flat" ? Minus : resolvedTone === "up" ? ArrowUp : ArrowDown
  const label =
    resolvedTone === "flat" ? "0%" : pct === null ? "New" : `${Math.abs(pct)}%`

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${toneStyles[resolvedTone]}`}>
      <Icon size={11} />
      {label}
    </span>
  )
}
