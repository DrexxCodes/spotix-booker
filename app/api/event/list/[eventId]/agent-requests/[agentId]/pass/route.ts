/**
 * app/api/event/list/[eventId]/agent-requests/[agentId]/pass/route.ts
 *
 * GET  -> current passConfig + monitoring stats (pool counts, sales) for
 *         this agent on this event.
 * POST -> booker issues/configures the physical pass. Two modes:
 *
 *   { mode: "unrestricted" }
 *     -> agent can sell any ticket type up to the event's own remaining
 *        stock. No pool documents created.
 *
 *   { mode: "pregenerated", allocations: [{ ticketType, count }, ...] }
 *     -> creates `count` ticket documents per type at
 *        agents/{agentId}/{eventId}/{ticketId}, status: "available".
 *        Calling this again ADDS more tickets on top of the existing pool
 *        (does not reset it) — lets a booker top up an agent's allocation
 *        mid-event.
 *
 * NOTE on stock validation: ticketPrices[i].quantity (if the booker capped
 * a ticket type) is the only per-type cap this codebase tracks — there's
 * no live "remaining after self-service sales" counter per type, only the
 * event-wide `ticketsSold`. Issuance is checked against the declared
 * quantity minus what's already been issued to any agent for that type, as
 * the best available signal; it does not account for self-service sales
 * depleting the same pool concurrently.
 */

import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { adminDb } from "@/lib/firebase-admin"
import { verifyAccessToken } from "@/lib/auth-tokens"
import { FieldValue } from "firebase-admin/firestore"

// Identical algorithm to backend/v1/ticket.js's generateTicketId() — pool
// passes must follow the same SPTX-TX-{8 digits, 2 letters at random
// positions} format as regular tickets, since the same code ends up
// printed/QR-encoded on physical paper either way.
function generatePassId(): string {
  const randomNumbers = Math.floor(10000000 + Math.random() * 90000000).toString()
  const randomLetters = Math.random().toString(36).substring(2, 4).toUpperCase()

  const pos1 = Math.floor(Math.random() * 8)
  const pos2 = Math.floor(Math.random() * 7) + pos1 + 1

  const part1 = randomNumbers.substring(0, pos1)
  const part2 = randomNumbers.substring(pos1, pos2)
  const part3 = randomNumbers.substring(pos2)

  return `SPTX-TX-${part1}${randomLetters[0]}${part2}${randomLetters[1]}${part3}`
}

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

  try {
    const requestRef = adminDb.collection("agentRequests").doc(eventId).collection("agents").doc(agentId)
    const requestSnap = await requestRef.get()
    if (!requestSnap.exists) return fail("Agent request not found", 404)
    if (requestSnap.data()!.status !== "accepted") return fail("Agent has not been accepted for this event", 400)

    const passConfig = requestSnap.data()!.passConfig || null

    // Pool stats (pregenerated mode only)
    const poolByType: Record<string, { available: number; reserved: number; sold: number }> = {}
    if (passConfig?.mode === "pregenerated") {
      const poolSnap = await adminDb.collection("agents").doc(agentId).collection(eventId).get()
      poolSnap.docs.forEach((d) => {
        const t = d.data().ticketType || "Unknown"
        const status = d.data().status || "available"
        poolByType[t] ??= { available: 0, reserved: 0, sold: 0 }
        if (status === "available") poolByType[t].available++
        else if (status === "reserved") poolByType[t].reserved++
        else if (status === "sold") poolByType[t].sold++
      })
    }

    // Sales stats (all modes) — successful References this agent created for this event
    const salesSnap = await adminDb
      .collection("Reference")
      .where("agentId", "==", agentId)
      .where("eventId", "==", eventId)
      .get()

    let totalSold = 0
    let totalRevenue = 0
    let pendingCount = 0
    salesSnap.docs.forEach((d) => {
      const r = d.data()
      if (r.status === "successful") {
        totalSold += r.totalTicketCount || 0
        totalRevenue += r.totalAmount || 0
      } else if (r.status === "pending") {
        pendingCount++
      }
    })

    return ok({
      passConfig,
      poolByType,
      stats: { totalSold, totalRevenue, pendingCount },
    })
  } catch (e: any) {
    console.error("[GET agent pass] failed", e)
    return fail("Failed to load pass details", 500)
  }
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
  const { snap: eventSnap } = owned
  const event = eventSnap.data()!

  let body: Record<string, any>
  try {
    body = await req.json()
  } catch {
    return fail("Invalid JSON body", 400)
  }

  const { mode, allocations } = body
  if (mode !== "unrestricted" && mode !== "pregenerated") {
    return fail('mode must be "unrestricted" or "pregenerated"', 400)
  }

  const requestRef = adminDb.collection("agentRequests").doc(eventId).collection("agents").doc(agentId)
  const requestSnap = await requestRef.get()
  if (!requestSnap.exists) return fail("Agent request not found", 404)
  if (requestSnap.data()!.status !== "accepted") return fail("Agent has not been accepted for this event", 400)

  const existingConfig = requestSnap.data()!.passConfig

  // ── Unrestricted mode ─────────────────────────────────────────────────────
  if (mode === "unrestricted") {
    try {
      await requestRef.update({
        passConfig: { mode: "unrestricted", configuredAt: FieldValue.serverTimestamp() },
      })
      return ok({ message: "Agent can now sell without a fixed allocation", passConfig: { mode: "unrestricted" } })
    } catch (e: any) {
      console.error("[POST agent pass] unrestricted failed", e)
      return fail("Failed to configure pass", 500)
    }
  }

  // ── Pregenerated mode ─────────────────────────────────────────────────────
  if (!Array.isArray(allocations) || allocations.length === 0) {
    return fail("allocations is required for pregenerated mode: [{ ticketType, count }]", 400)
  }

  const ticketPrices: { policy: string; price: number; availableTickets?: number | string }[] = event.ticketPrices || []
  const priceByType: Record<string, number> = {}
  if (event.isFree) {
    priceByType["General"] = 0
  } else {
    ticketPrices.forEach((t) => (priceByType[t.policy] = Number(t.price) || 0))
  }

  for (const a of allocations) {
    if (!a.ticketType || !(a.ticketType in priceByType)) {
      return fail(`Unknown ticket type: ${a.ticketType}`, 400)
    }
    const count = Number(a.count)
    if (!Number.isInteger(count) || count < 1) {
      return fail(`Invalid count for ticket type ${a.ticketType}`, 400)
    }
  }

  try {
    const poolCollection = adminDb.collection("agents").doc(agentId).collection(eventId)
    let created = 0

    for (const a of allocations) {
      const count = Number(a.count)
      const price = priceByType[a.ticketType]

      // Firestore batches cap at 500 writes — chunk defensively.
      for (let i = 0; i < count; i += 400) {
        const chunkSize = Math.min(400, count - i)
        const batch = adminDb.batch()
        for (let j = 0; j < chunkSize; j++) {
          const ticketRef = poolCollection.doc(generatePassId())
          batch.set(ticketRef, {
            ticketType: a.ticketType,
            price,
            status: "available",
            issuedAt: FieldValue.serverTimestamp(),
          })
        }
        await batch.commit()
        created += chunkSize
      }
    }

    const byType: Record<string, number> = existingConfig?.mode === "pregenerated" ? existingConfig.byType || {} : {}
    allocations.forEach((a: any) => {
      byType[a.ticketType] = (byType[a.ticketType] || 0) + Number(a.count)
    })

    await requestRef.update({
      passConfig: { mode: "pregenerated", byType, configuredAt: FieldValue.serverTimestamp() },
    })

    return ok({
      message: `Issued ${created} ticket(s)`,
      passConfig: { mode: "pregenerated", byType },
    })
  } catch (e: any) {
    console.error("[POST agent pass] pregenerated failed", e)
    return fail("Failed to issue tickets", 500)
  }
}
