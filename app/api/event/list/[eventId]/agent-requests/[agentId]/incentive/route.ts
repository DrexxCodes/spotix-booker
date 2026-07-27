/**
 * app/api/event/list/[eventId]/agent-requests/[agentId]/incentive/route.ts
 *
 * GET  -> current incentive config for this agent on this event.
 * POST -> booker sets it. Body: { type: "percentage" | "flat", value: number }
 *
 *   "percentage" -> value% of the ticket subtotal (paymentData.ticketPrice —
 *                   NOT the buyer-side fee, which was never the booker's
 *                   money) per sale.
 *   "flat"       -> a fixed ₦ amount per sale (once per reference, not
 *                   multiplied by ticket quantity).
 *
 * Stored on agentRequests/{eventId}/agents/{agentId}.incentive — the
 * backend's processAgentSale() (backend/v1/ticket.js) reads it at payment
 * time, computes the incentive, writes it to
 * agents/{agentId}/transactions/{YYYY-MM-DD}, and deducts it from what
 * gets recorded as the booker's own revenue for that day.
 *
 * Access: event owner only (same as sibling routes).
 */

import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { adminDb } from "@/lib/firebase-admin"
import { verifyAccessToken } from "@/lib/auth-tokens"

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

async function resolveOwnedEvent(eventId: string, userId: string) {
  const ref = adminDb.collection("events").doc(eventId)
  const snap = await ref.get()
  if (!snap.exists) return fail("Event not found", 404)
  if (snap.data()!.organizerId !== userId) return fail("Forbidden: you do not own this event", 403)
  return { snap, ref }
}

// -- GET ------------------------------------------------------------------------
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string; agentId: string }> }
) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  const { eventId, agentId } = await params
  const owned = await resolveOwnedEvent(eventId, userId)
  if (owned instanceof NextResponse) return owned

  const requestRef = adminDb.collection("agentRequests").doc(eventId).collection("agents").doc(agentId)
  const requestSnap = await requestRef.get()
  if (!requestSnap.exists) return fail("Agent request not found", 404)

  return ok({ incentive: requestSnap.data()!.incentive || null })
}

// -- POST -----------------------------------------------------------------------
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string; agentId: string }> }
) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  const { eventId, agentId } = await params
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

  const requestRef = adminDb.collection("agentRequests").doc(eventId).collection("agents").doc(agentId)
  const requestSnap = await requestRef.get()
  if (!requestSnap.exists) return fail("Agent request not found", 404)
  if (requestSnap.data()!.status !== "accepted") return fail("Agent has not been accepted for this event", 400)

  try {
    await requestRef.update({ incentive: { type, value: numValue } })
    return ok({ message: "Incentive updated", incentive: { type, value: numValue } })
  } catch (e: any) {
    console.error("[POST agent incentive] failed", e)
    return fail("Failed to update incentive", 500)
  }
}
