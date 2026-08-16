/**
 * lib/payout-access-gate.ts
 *
 * PAYOUT_ACCESS_SECRET (no NEXT_PUBLIC_ prefix — never bundled into
 * client JS, never sent to the browser) gates every payout route.
 *
 * The browser never knows this value. It's attached server-side by
 * middleware.ts on the way in to /api/payout* and /api/polls/payout*,
 * and stripped from (any forged copy in) the incoming request first —
 * so the ONLY way this header can be present and correct on a request
 * that reaches a route handler is if it passed through our own
 * middleware. A request that reaches the route handler by any other
 * path (direct hit on the deployed function, a misconfigured proxy,
 * etc.) arrives without it and is rejected with 401 here, before the
 * normal spotix_at cookie check even runs.
 */

import { NextRequest, NextResponse } from "next/server"

const DEV_TAG = "spotix-api-v1"
export const PAYOUT_ACCESS_HEADER = "x-payout-access-key"

export function requirePayoutAccessKey(req: NextRequest): NextResponse | null {
  const secret = process.env.PAYOUT_ACCESS_SECRET
  if (!secret) {
    // Misconfiguration must fail closed on a payments route.
    console.error("[payout-access-gate] PAYOUT_ACCESS_SECRET is not set")
    return NextResponse.json({ success: false, error: "Server configuration error", developer: DEV_TAG }, { status: 500 })
  }

  const provided = req.headers.get(PAYOUT_ACCESS_HEADER)
  if (provided !== secret) {
    return NextResponse.json({ success: false, error: "Unauthorized", developer: DEV_TAG }, { status: 401 })
  }
  return null
}
