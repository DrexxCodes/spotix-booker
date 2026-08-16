/**
 * app/api/payout/stream/route.ts
 *
 * GET /api/payout/stream?reference=SPTX-TRNS-...
 *
 * The ONLY thing the browser talks to for live payout status. Auth here
 * is the normal `spotix_at` cookie (same-origin, works natively with
 * EventSource — no cross-origin cookie or custom-header gymnastics).
 *
 * After confirming the caller actually owns this payout reference, this
 * route proxies spotix-backend's internal SSE endpoint
 * (GET /v1/payout/stream, protected by x-internal-secret) and pipes its
 * byte stream straight through to the browser. The browser never sees
 * the internal secret, the backend URL's internal shape, or anything
 * Supabase — this route is a plain trusted relay.
 */

import { NextRequest } from "next/server"
import { cookies } from "next/headers"
import { verifyAccessToken } from "@/lib/auth-tokens"
import { getPayoutByReference } from "@/lib/payout-db"
import { requirePayoutAccessKey } from "@/lib/payout-access-gate"

export async function GET(req: NextRequest) {
  const gate = requirePayoutAccessKey(req)
  if (gate) return gate

  const cookieStore = await cookies()
  const token = cookieStore.get("spotix_at")?.value
  if (!token) return new Response("Unauthorized", { status: 401 })

  let userId: string
  try {
    const payload = await verifyAccessToken(token, "spotix-booker")
    userId = payload.uid
  } catch {
    return new Response("Unauthorized", { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const reference = searchParams.get("reference")
  if (!reference) return new Response("reference is required", { status: 400 })

  // Ownership check — defense in depth on top of the reference itself
  // being an unguessable, timestamped string.
  const row = await getPayoutByReference(reference)
  if (!row) return new Response("Payout not found", { status: 404 })
  if (row.user_id !== userId) return new Response("Forbidden", { status: 403 })

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL
  const secret = process.env.CRON_SECRET
  if (!backendUrl || !secret) {
    return new Response("Server configuration error", { status: 500 })
  }

  const upstream = await fetch(`${backendUrl}/v1/payout/stream?reference=${encodeURIComponent(reference)}`, {
    headers: { "x-internal-secret": secret },
    // @ts-expect-error - duplex is required by undici for streaming fetch bodies but missing from the TS lib
    duplex: "half",
  })

  if (!upstream.body) {
    return new Response("Upstream stream unavailable", { status: 502 })
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}
