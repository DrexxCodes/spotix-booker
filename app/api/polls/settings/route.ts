/**
 * app/api/polls/settings/route.ts
 *
 * GET  /api/polls/settings?pollId=xxx
 *   → Returns current linkage info for the poll (eventId, eventName if
 *     linked), plus `role` ("owner" | "member") and `canAddAdmin` for the
 *     requester so the Settings page can render for a poll team member
 *     (same page the creator sees) while still gating the event link/
 *     unlink controls and the "Add" button on the Team panel appropriately.
 *     Callable by the poll creator or any active team member.
 *
 * POST /api/polls/settings
 *   Body: { pollId, eventId, action: "link" | "unlink" }
 *   → Links or unlinks a poll ↔ event. Poll-creator-only, regardless of
 *     team membership — this stays out of scope for canAddAdmin, which
 *     only ever governs adding team members.
 *
 * On LINK:
 *   - Checks events/{eventId} for an existing votingId — returns 409 if already linked to a different poll
 *   - Writes  votingId     to events/{eventId}
 *   - Writes  linkedEventId + linkedEventName  to voting/{pollId}
 *
 * On UNLINK:
 *   - Removes votingId from events/{eventId}
 *   - Removes linkedEventId + linkedEventName from voting/{pollId}
 */

import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { adminDb } from "@/lib/firebase-admin"
import { verifyAccessToken } from "@/lib/auth-tokens"
import { FieldValue } from "firebase-admin/firestore"
import { resolvePollAccess } from "@/lib/poll-team-access"

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

// ── GET: current linkage ──────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  const pollId = req.nextUrl.searchParams.get("pollId")
  if (!pollId) return fail("pollId is required", 400)

  try {
    const access = await resolvePollAccess(pollId, userId)
    if (!access.ok) return fail(access.error, access.status)

    const d = access.pollSnap.data()!

    return ok({
      pollId,
      pollName:        d.pollName        ?? "",
      linkedEventId:   d.linkedEventId   ?? null,
      linkedEventName: d.linkedEventName ?? null,
      role:            access.role,
      canAddAdmin:     access.canAddAdmin,
    })
  } catch (err) {
    console.error("[GET /api/polls/settings]", err)
    return fail("Internal server error", 500)
  }
}

// ── POST: link or unlink ──────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  let body: { pollId?: string; eventId?: string; action?: string }
  try { body = await req.json() } catch { return fail("Invalid JSON body", 400) }

  const { pollId, eventId, action } = body
  if (!pollId || !action) return fail("pollId and action are required", 400)
  if (action === "link" && !eventId) return fail("eventId is required to link", 400)

  try {
    // Verify poll ownership
    const pollRef  = adminDb.collection("voting").doc(pollId)
    const pollSnap = await pollRef.get()
    if (!pollSnap.exists) return fail("Poll not found", 404)
    const pollData = pollSnap.data()!
    if (pollData.creatorId !== userId && pollData.organizerId !== userId)
      return fail("Forbidden", 403)

    // ── UNLINK ─────────────────────────────────────────────────────────────
    if (action === "unlink") {
      const currentEventId = pollData.linkedEventId ?? null
      await pollRef.update({
        linkedEventId:   FieldValue.delete(),
        linkedEventName: FieldValue.delete(),
        updatedAt:       FieldValue.serverTimestamp(),
      })
      // Also clear votingId from the event doc (best-effort)
      if (currentEventId) {
        try {
          await adminDb.collection("events").doc(currentEventId).update({
            votingId:       FieldValue.delete(),
            votingPollName: FieldValue.delete(),
          })
        } catch { /* Event may not exist — non-fatal */ }
      }
      return ok({ message: "Poll unlinked from event successfully" })
    }

    // ── LINK ───────────────────────────────────────────────────────────────
    if (action === "link") {
      // Verify event ownership
      const eventRef  = adminDb.collection("events").doc(eventId!)
      const eventSnap = await eventRef.get()
      if (!eventSnap.exists) return fail("Event not found", 404)
      const eventData = eventSnap.data()!
      if (eventData.createdBy !== userId && eventData.organizerId !== userId)
        return fail("Forbidden — you don't own this event", 403)

      // Check if event already has a different poll linked
      if (eventData.votingId && eventData.votingId !== pollId) {
        return fail(
          `This event already has a poll linked (Poll ID: ${eventData.votingId}). Unlink it first before associating a new poll.`,
          409
        )
      }

      const eventName = eventData.eventName ?? "Unnamed Event"

      // Write both sides
      await pollRef.update({
        linkedEventId:   eventId,
        linkedEventName: eventName,
        updatedAt:       FieldValue.serverTimestamp(),
      })
      await eventRef.update({
        votingId:       pollId,
        votingPollName: pollData.pollName ?? "",
      })

      return ok({
        message:         "Poll linked to event successfully",
        linkedEventId:   eventId,
        linkedEventName: eventName,
      })
    }

    return fail("Invalid action. Use 'link' or 'unlink'.", 400)
  } catch (err) {
    console.error("[POST /api/polls/settings]", err)
    return fail("Internal server error", 500)
  }
}
