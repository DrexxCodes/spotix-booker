/**
 * app/api/event/list/[eventId]/agent-incentive/route.ts
 *
 * GET  -> the event-wide incentive config, plus whether agent activity is on.
 * POST -> booker sets it. Body: { type: "percentage" | "flat", value: number }
 *
 * Incentives are the SAME for every agent on a given event — set once here
 * by the booker, not per-agent. This replaced the old per-agent incentive
 * stored on agentRequests/{eventId}/agents/{agentId}.incentive (see the
 * agent-requests/[agentId]/incentive route, now removed from the UI).
 *
 *   "percentage" -> value% of the ticket subtotal (paymentData.ticketPrice —
 *                   NOT the buyer-side fee, which was never the booker's
 *                   money) per sale.
 *   "flat"       -> a fixed ₦ amount per sale (once per reference, not
 *                   multiplied by ticket quantity).
 *
 * Stored on events/{eventId}.agentIncentive — the backend's
 * processAgentSale() (backend/v1/ticket.js) reads it at payment time,
 * computes the incentive, writes it to agents/{agentId}/transactions/{YYYY-MM-DD},
 * and deducts it from what gets recorded as the booker's own revenue for
 * that day.
 *
 * Agents cannot request to sell for an event (spotix-agent's
 * POST /api/v1/agent/requests) until this is set — enforced there, not
 * here, but this route is where the booker fixes that.
 *
 * Access: event owner only (same as sibling routes).
 */

import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyAccessToken } from "@/lib/auth-tokens"
import { resolveEventAccess, isOwnerOrAdmin } from "@/lib/event-access"

const DEV_TAG = "spotix-api-v1"

function ok(data: object, status = 200) {
  return NextResponse.json({ success: true, developer: DEV_TAG, ...data }, { status })
}
function fail(message: string, status: number) {
  return NextResponse.json({ success: false, error: message, developer: DEV_TAG }, { status })
}

async function authenticate(): Promise<{ userId: string } | NextResponse> {
  const cookieStore = await cookies()
  const token = cookieStore.get("spotix_at")?.value
  if (!token) return fail("No access token", 401)
  try {
    const payload = await verifyAccessToken(token, "spotix-booker")
    return { userId: payload.uid }
  } catch {
    return fail("Invalid or expired access token", 401)
  }
}

// Same as agent-requests: Creator or Admin only, no custom-role path
// (agent activity/incentive management lives under the Teams tab, which
// custom roles can never be granted — see app/lib/team-tabs.ts).
async function resolveOwnedEvent(eventId: string, userId: string) {
  const access = await resolveEventAccess(eventId, userId)
  if (!access.ok) return fail(access.error, access.status)
  if (!isOwnerOrAdmin(access)) {
    return fail("Forbidden: only the Event Creator or an Admin can manage agent incentives", 403)
  }
  return { snap: access.eventSnap, ref: access.eventRef }
}

// -- GET ------------------------------------------------------------------------
export async function GET(req: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  const { eventId } = await params
  const owned = await resolveOwnedEvent(eventId, userId)
  if (owned instanceof NextResponse) return owned

  const data = owned.snap.data()!
  return ok({ incentive: data.agentIncentive || null, allowAgents: !!data.allowAgents })
}

// -- POST -----------------------------------------------------------------------
export async function POST(req: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  const { eventId } = await params
  const owned = await resolveOwnedEvent(eventId, userId)
  if (owned instanceof NextResponse) return owned

  let body: Record<string, any>
  try {
    body = await req.json()
  } catch {
    return fail("Invalid JSON body", 400)
  }

  const { type, value } = body
  if (type !== "percentage" && type !== "flat") return fail('type must be "percentage" or "flat"', 400)

  const numValue = Number(value)
  if (!Number.isFinite(numValue) || numValue < 0) return fail("value must be a non-negative number", 400)
  if (type === "percentage" && numValue > 100) return fail("Percentage cannot exceed 100", 400)

  try {
    const agentIncentive = { type, value: numValue }
    await owned.ref.update({ agentIncentive })
    return ok({ message: "Incentive updated for all agents on this event", incentive: agentIncentive })
  } catch (e: any) {
    console.error("[POST agent-incentive] failed", e)
    return fail("Failed to update incentive", 500)
  }
}
