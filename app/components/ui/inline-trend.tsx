"use client"

import { ArrowUp, ArrowDown, Minus } from "lucide-react"

/**
 * Compact "▲12%" / "▼8%" / "No change" text used directly under a big
 * stat-card number (Tickets Sold, Total Revenue, poll Revenue) — a
 * smaller, plainer sibling of SalesTrendBadge (which is pill-shaped, for
 * section headers). Green = rise, red = drop, amber/yellow = unchanged
 * from yesterday. See lib/sales-trend.ts for how `pct`/`tone` are
 * computed and capped at ±100%.
 */
export function InlineTrend({ pct, tone }: { pct: number | null; tone: "up" | "down" | "flat" }) {
  const styles: Record<"up" | "down" | "flat", string> = {
    up: "text-emerald-600",
    down: "text-red-600",
    flat: "text-amber-600",
  }
  const Icon = tone === "flat" ? Minus : tone === "up" ? ArrowUp : ArrowDown
  const label =
    tone === "flat" ? "No change since yesterday" : pct === null ? "New — none yesterday" : `${Math.abs(pct)}% since yesterday`

  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold mt-2 ${styles[tone]}`}>
      <Icon size={12} />
      {label}
    </span>
  )
}
