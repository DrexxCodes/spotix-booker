// app/api/sync/route.ts
// POST /api/sync  — two purposes depending on the body:
//
//   1. { eventId }                          → generate + store sync key (called by attendees-tab export)
//   2. { eventId, key, checkedInTickets }   → verify key and write check-in data back to Firebase
//
// Auth: uses spotix_at httpOnly cookie for POST without checkedInTickets (booker session).
//       For the scanner sync POST (with checkedInTickets), the key itself is the auth mechanism.
//
// CORS: the scanner is a cross-origin caller (Electron renderer / ngrok tunnel), so every
//       response must carry Access-Control-Allow-Origin. The OPTIONS preflight is handled
//       explicitly so Next.js doesn't swallow it before our headers are attached.

import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { adminDb } from "@/lib/firebase-admin"
import { verifyAccessToken } from "@/lib/auth-tokens"

const DEV_TAG = "spotix-api-v1"

// ─── CORS ─────────────────────────────────────────────────────────────────────
// Allow the scanner (any origin — it's key-authenticated, not session-authenticated)
// to reach Branch A. Branch B (key generation) still requires a booker cookie so
// opening CORS there is safe — an unauthenticated cross-origin caller will just get 401.

const CORS_HEADERS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, ngrok-skip-browser-warning",
}

/** Attach CORS headers to any NextResponse */
function withCors(res: NextResponse): NextResponse {
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.headers.set(k, v))
  return res
}

function ok(data: object) {
  return withCors(
    NextResponse.json({ success: true, developer: DEV_TAG, ...data })
  )
}

function fail(message: string, status = 400) {
  return withCors(
    NextResponse.json({ success: false, error: message, developer: DEV_TAG }, { status })
  )
}

/** Cryptographically random 12-char alphanumeric key */
function generateSyncKey(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789"
  const arr = new Uint8Array(12)
  crypto.getRandomValues(arr)
  return Array.from(arr, (b) => chars[b % chars.length]).join("")
}

// ─── OPTIONS (CORS preflight) ─────────────────────────────────────────────────
// Next.js handles OPTIONS automatically but does NOT attach custom headers, so
// the browser sees a preflight with no Allow-Origin and blocks the real request.
// Exporting OPTIONS here takes over and stamps the correct headers.

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

// ─── POST ────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return fail("Invalid JSON body")
  }

  const { eventId, key, checkedInTickets } = body as {
    eventId?: string
    key?: string
    checkedInTickets?: Array<{ ticketId: string; checkedInAt: string }>
  }

  if (!eventId) return fail("eventId is required")

  // ── Branch A: Scanner sync (key + tickets provided — no session needed) ────
  if (key && Array.isArray(checkedInTickets)) {
    return handleScannerSync(eventId, key, checkedInTickets)
  }

  // ── Branch B: Generate sync key (requires booker session) ────────────────
  const cookieStore = await cookies()
  const token = cookieStore.get("spotix_at")?.value
  if (!token) return fail("Authentication required", 401)

  try {
    await verifyAccessToken(token, "spotix-booker")
  } catch {
    return fail("Invalid or expired access token", 401)
  }

  const syncKey = generateSyncKey()

  try {
    await adminDb.collection("events").doc(eventId).update({
      syncKey,
      syncKeyCreatedAt: new Date().toISOString(),
    })
  } catch (e) {
    console.error("[/api/sync] Failed to store sync key:", e)
    return fail("Failed to store sync key", 500)
  }

  return ok({ key: syncKey })
}

// ─── Scanner sync handler ────────────────────────────────────────────────────

async function handleScannerSync(
  eventId: string,
  key: string,
  checkedInTickets: Array<{ ticketId: string; checkedInAt: string }>
) {
  // 1. Verify key
  let eventDoc: FirebaseFirestore.DocumentSnapshot
  try {
    eventDoc = await adminDb.collection("events").doc(eventId).get()
  } catch (e) {
    console.error("[/api/sync] Error fetching event:", e)
    return fail("Error fetching event", 500)
  }

  if (!eventDoc.exists) return fail("Event not found", 404)

  const eventData = eventDoc.data()!
  if (eventData.syncKey !== key) {
    return fail("Invalid sync key", 403)
  }

  // 2. Write check-in data to both locations
  const batch = adminDb.batch()
  const errors: string[] = []

  for (const { ticketId, checkedInAt } of checkedInTickets) {
    try {
      // events/{eventId}/attendees/{ticketId}  — verified + checkedInAt
      const attendeeRef = adminDb
        .collection("events")
        .doc(eventId)
        .collection("attendees")
        .doc(ticketId)

      batch.update(attendeeRef, {
        verified: true,
        checkedInAt: checkedInAt ?? new Date().toISOString(),
      })

      // tickets/{ticketId} — verified flag
      const ticketRef = adminDb.collection("tickets").doc(ticketId)
      batch.update(ticketRef, { verified: true })
    } catch (e) {
      errors.push(ticketId)
    }
  }

  try {
    await batch.commit()
  } catch (e) {
    console.error("[/api/sync] Batch commit failed:", e)
    return fail("Batch write failed — check server logs", 500)
  }

  return ok({
    synced: checkedInTickets.length - errors.length,
    failed: errors.length,
    failedTicketIds: errors,
  })
}
