/**
 * app/lib/pdf-report-kit.ts
 *
 * Tiny shared primitives for spotix-booker's client-side, compute-and-
 * download report builders (Payouts tab export, poll payout export) — the
 * bits that have nothing to do with what a given report contains: the
 * brand color, a Naira formatter, and CSV cell/row escaping. Pulled out so
 * app/lib/payout-export.ts and app/lib/poll-payout-export.ts don't each
 * carry their own copy.
 */

// Brand purple, used throughout spotix-booker (buttons, active tab
// underline, the post-mortem PDF's header band, etc).
export const BRAND_HEX = "#6b2fa5"

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "")
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

export function naira(n: number): string {
  // jsPDF's built-in fonts don't carry the ₦ glyph (same reason the post
  // mortem PDF had to vendor a custom font for it) — "N" reads fine in a
  // report context and avoids shipping a font just for this.
  return `N${Math.round(Number(n) || 0).toLocaleString()}`
}

export function csvCell(v: unknown): string {
  return `"${String(v ?? "").replace(/"/g, '""')}"`
}

export function csvRow(cells: unknown[]): string {
  return cells.map(csvCell).join(",")
}
