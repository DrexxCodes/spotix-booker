/**
 * app/api/event/list/[eventId]/agent-requests/route.ts
 *
 * GET   /api/event/list/[eventId]/agent-requests
 *   -> All agent affiliation requests for this event (agentRequests/{eventId}/agents/*)
 *
 * PATCH /api/event/list/[eventId]/agent-requests
 *   Body { agentId, action: "accept" | "reject" | "revoke", reason? }
 *   -> Booker accepts, rejects, or revokes (removes) an agent's request to
 *      sell tickets. "revoke" requires a non-empty `reason` and only
 *      applies to a currently-accepted agent — it deletes every unsold
 *      pass in that agent's pool for this event and marks the mirror doc
 *      (agents/{agentId}/events/{eventId}) as "revoked" with the reason,
 *      which is visible to the agent and to any other booker considering
 *      the same agent for a future event.
 *
 * Same auth pattern as the sibling route.ts: spotix_at cookie, ownership
 * enforced against events/{eventId}.organizerId.
 */

import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { adminDb } from "@/lib/firebase-admin"
import { verifyAccessToken } from "@/lib/auth-tokens"
import { FieldValue } from "firebase-admin/firestore"
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

// Agent requests aren't a grantable custom-role tab (see
// app/lib/team-tabs.ts — "agentRequests" only appears in the Admin
// built-in role's tab list). So access here is Creator OR Admin, full
// stop — no custom-permission path, unlike referrals/merch/etc.
async function resolveOwnedEvent(eventId: string, userId: string) {
  const access = await resolveEventAccess(eventId, userId)
  if (!access.ok) return fail(access.error, access.status)
  if (!isOwnerOrAdmin(access)) {
    return fail("Forbidden: only the Event Creator or an Admin can manage agent requests", 403)
  }
  return { snap: access.eventSnap, ref: access.eventRef }
}

// -- GET ------------------------------------------------------------------------
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  const { eventId } = await params
  const owned = await resolveOwnedEvent(eventId, userId)
  if (owned instanceof NextResponse) return owned

  try {
    const snap = await adminDb
      .collection("agentRequests")
      .doc(eventId)
      .collection("agents")
      .orderBy("requestedAt", "desc")
      .get()

    const requests = snap.docs.map((d) => {
      const r = d.data()
      return {
        agentId: r.agentId,
        agentUserId: r.agentUserId,
        agentName: r.agentName || "",
        agentProfile: r.agentProfile || null,
        status: r.status,
        passConfig: r.passConfig || null,
        requestedAt: r.requestedAt?.toDate?.()?.toISOString() ?? null,
        respondedAt: r.respondedAt?.toDate?.()?.toISOString() ?? null,
        revokedAt: r.revokedAt?.toDate?.()?.toISOString() ?? null,
        revokedReason: r.revokedReason || null,
      }
    })

    return ok({ requests })
  } catch (e: any) {
    console.error("[GET agent-requests] failed", e)
    return fail("Failed to load agent requests", 500)
  }
}

// -- PATCH ------------------------------------------------------------------------
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
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

  const { agentId, action, reason } = body
  if (!agentId) return fail("agentId is required", 400)
  if (action !== "accept" && action !== "reject" && action !== "revoke") {
    return fail('action must be "accept", "reject", or "revoke"', 400)
  }

  const requestRef = adminDb.collection("agentRequests").doc(eventId).collection("agents").doc(agentId)
  const requestSnap = await requestRef.get()
  if (!requestSnap.exists) return fail("Agent request not found", 404)

  if (action === "revoke") {
    if (requestSnap.data()?.status !== "accepted") {
      return fail("Only an accepted agent can be removed", 400)
    }
    if (!reason?.trim()) {
      return fail("A reason is required to remove this agent", 400)
    }

    try {
      const eventName = owned.snap.data()?.eventName || ""
      const revokedAt = FieldValue.serverTimestamp()
      const bookerDoc = await adminDb.collection("users").doc(userId).get()
      const bookerName = bookerDoc.data()?.fullName || bookerDoc.data()?.organizationName || "The organizer"

      const revocationFields = {
        status: "revoked",
        revokedAt,
        revokedReason: reason.trim(),
        revokedBy: userId,
        revokedByName: bookerName,
      }

      const batch = adminDb.batch()
      batch.update(requestRef, revocationFields)
      batch.set(
        adminDb.collection("agents").doc(agentId).collection("events").doc(eventId),
        { ...revocationFields, organizerId: userId, eventName },
        { merge: true }
      )

      // Delete every pass still in the agent's pool for this event that
      // hasn't been sold — "removing an agent deletes all the passes that
      // have been assigned to them". Passes already sold are left alone:
      // they're real tickets a buyer paid for and holds, not allocation
      // bookkeeping, and deleting that record would orphan a completed sale.
      const poolSnap = await adminDb.collection("agents").doc(agentId).collection(eventId).get()
      let deletedCount = 0
      const toDelete = poolSnap.docs.filter((d) => d.data().status !== "sold")
      for (let i = 0; i < toDelete.length; i += 400) {
        const chunk = toDelete.slice(i, i + 400)
        const delBatch = adminDb.batch()
        chunk.forEach((d) => delBatch.delete(d.ref))
        await delBatch.commit()
        deletedCount += chunk.length
      }

      await batch.commit()

      return ok({ message: "Agent removed from this event", status: "revoked", passesDeleted: deletedCount })
    } catch (e: any) {
      console.error("[PATCH agent-requests revoke] failed", e)
      return fail("Failed to remove this agent", 500)
    }
  }

  const newStatus = action === "accept" ? "accepted" : "rejected"

  try {
    const eventName = owned.snap.data()?.eventName || ""
    const batch = adminDb.batch()
    batch.update(requestRef, { status: newStatus, respondedAt: FieldValue.serverTimestamp() })
    batch.set(
      adminDb.collection("agents").doc(agentId).collection("events").doc(eventId),
      { status: newStatus, respondedAt: FieldValue.serverTimestamp(), organizerId: userId, eventName },
      { merge: true }
    )
    await batch.commit()

    return ok({ message: `Agent ${newStatus}`, status: newStatus })
  } catch (e: any) {
    console.error("[PATCH agent-requests] failed", e)
    return fail("Failed to update agent request", 500)
  }
}
