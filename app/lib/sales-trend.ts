/**
 * Shared day-over-day sales trend logic — used by the dashboard's
 * Events/Polls badges (api/revenue/route.ts) and the event-info Overview
 * tab's sales card (lib/event-bundle.ts). Reads the exact `ticketSales`
 * (events) / `voteSales` (polls) fields already written to the
 * admin/events/{eventId}/{date} and admin/votes/{pollId}/{date} day-docs —
 * the same collection the Payouts tab already reads to list transaction
 * days — comparing today's total against yesterday's.
 */

export type TrendTone = "up" | "down" | "flat"

export interface SalesTrend {
  /** null when there's no meaningful percentage to show (both days zero). */
  pct: number | null
  tone: TrendTone
  today: number
  yesterday: number
}

export function computeSalesTrend(today: number, yesterday: number): SalesTrend {
  if (today === yesterday) {
    return { pct: 0, tone: "flat", today, yesterday }
  }
  if (yesterday === 0) {
    // No baseline to divide by — today is strictly higher (handled above
    // when equal), so this is a rise from nothing. Reported as null pct
    // (a percentage from zero is undefined) but still tone "up".
    return { pct: null, tone: "up", today, yesterday }
  }
  const rawPct = ((today - yesterday) / yesterday) * 100
  // Capped at ±100% — a swing bigger than that (e.g. one ₦200k ticket
  // yesterday vs fifty ₦2k tickets today) is still real, but displaying
  // "500% profit/loss" reads as broken rather than informative.
  const pct = Math.max(-100, Math.min(100, Math.round(rawPct)))
  return { pct, tone: pct > 0 ? "up" : pct < 0 ? "down" : "flat", today, yesterday }
}

function ymd(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function todayAndYesterdayKeys(): { today: string; yesterday: string } {
  const now = new Date()
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  return { today: ymd(now), yesterday: ymd(yesterday) }
}
