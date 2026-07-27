/**
 * app/api/agents/[agentId]/rating/route.ts
 *
 * GET  /api/agents/[agentId]/rating
 *   -> { canRate, myRating } for the logged-in booker. canRate is true only
 *      if the booker has accepted this agent on at least one of their own
 *      events (agents/{agentId}/events/{eventId}.status === "accepted" &&
 *      .organizerId === booker uid — see the agent-requests PATCH route,
 *      which now stamps organizerId on accept).
 *
 * POST /api/agents/[agentId]/rating
 *   Body { eventId, rating (1-5), comment? }
 *   -> Upserts agentRatings/{agentId}/reviews/{bookerId} and recomputes
 *      agents/{agentId}.averageRating / totalRatings in a transaction so
 *      the aggregate never drifts even if a booker edits their rating later.
 *
 * Bookers are event organizers, not ticket buyers — "worked with" means the
 * booker accepted the agent's request to sell for one of their events, per
 * the agent-requests accept/reject flow.
 */

import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { adminDb } from "@/lib/firebase-admin"
import { verifyAccessToken } from "@/lib/auth-tokens"
import { FieldValue } from "firebase-admin/firestore"

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

/** Does this booker have an accepted relationship with this agent? */
async function findEligibleEvent(agentId: string, bookerId: string): Promise<{ eventId: string; eventName: string } | null> {
  const snap = await adminDb
    .collection("agents")
    .doc(agentId)
    .collection("events")
    .where("status", "==", "accepted")
    .where("organizerId", "==", bookerId)
    .limit(1)
    .get()
  if (snap.empty) return null
  const doc = snap.docs[0]
  return { eventId: doc.id, eventName: doc.data().eventName || "" }
}

// -- GET ------------------------------------------------------------------------
export async function GET(req: NextRequest, { params }: { params: Promise<{ agentId: string }> }) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth
  const { userId } = auth
  const { agentId } = await params

  try {
    const eligible = await findEligibleEvent(agentId, userId)
    const myRatingDoc = await adminDb.collection("agentRatings").doc(agentId).collection("reviews").doc(userId).get()

    return ok({
      canRate: !!eligible,
      eligibleEvent: eligible,
      myRating: myRatingDoc.exists
        ? {
            rating: myRatingDoc.data()!.rating,
            comment: myRatingDoc.data()!.comment || "",
            updatedAt: myRatingDoc.data()!.updatedAt?.toDate?.()?.toISOString() ?? null,
          }
        : null,
    })
  } catch (e: any) {
    console.error("[GET agent rating] failed", e)
    return fail("Failed to load rating", 500)
  }
}

// -- POST -----------------------------------------------------------------------
export async function POST(req: NextRequest, { params }: { params: Promise<{ agentId: string }> }) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth
  const { userId } = auth
  const { agentId } = await params

  let body: Record<string, any>
  try {
    body = await req.json()
  } catch {
    return fail("Invalid JSON body", 400)
  }

  const { eventId, rating, comment } = body
  const numRating = Number(rating)
  if (!Number.isInteger(numRating) || numRating < 1 || numRating > 5) {
    return fail("rating must be a whole number between 1 and 5", 400)
  }
  if (comment && String(comment).length > 500) {
    return fail("comment must be 500 characters or fewer", 400)
  }

  const eligible = await findEligibleEvent(agentId, userId)
  if (!eligible) {
    return fail("You can only rate agents you've accepted to sell for one of your events", 403)
  }
  const finalEventId = eventId || eligible.eventId

  try {
    const [userDoc] = await Promise.all([adminDb.collection("users").doc(userId).get()])
    const bookerName = userDoc.data()?.fullName || userDoc.data()?.organizationName || "A booker"

    const agentRef = adminDb.collection("agents").doc(agentId)
    const reviewRef = adminDb.collection("agentRatings").doc(agentId).collection("reviews").doc(userId)

    await adminDb.runTransaction(async (tx) => {
      const [agentSnap, reviewSnap] = await Promise.all([tx.get(agentRef), tx.get(reviewRef)])
      const agentData = agentSnap.data() || {}
      const prevTotal = agentData.totalRatings || 0
      const prevAvg = agentData.averageRating || 0
      const previousRating = reviewSnap.exists ? reviewSnap.data()!.rating : null

      let newTotal: number
      let newAvg: number
      if (previousRating === null) {
        newTotal = prevTotal + 1
        newAvg = (prevAvg * prevTotal + numRating) / newTotal
      } else {
        newTotal = prevTotal
        newAvg = newTotal > 0 ? (prevAvg * prevTotal - previousRating + numRating) / newTotal : 0
      }

      tx.set(
        reviewRef,
        {
          bookerId: userId,
          bookerName,
          eventId: finalEventId,
          eventName: eligible.eventName,
          rating: numRating,
          comment: comment ? String(comment).trim() : "",
          createdAt: reviewSnap.exists ? reviewSnap.data()!.createdAt : FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      )
      tx.set(agentRef, { averageRating: Math.round(newAvg * 100) / 100, totalRatings: newTotal }, { merge: true })
    })

    return ok({ message: previousRatingMessage(numRating) })
  } catch (e: any) {
    console.error("[POST agent rating] failed", e)
    return fail("Failed to save your rating", 500)
  }
}

function previousRatingMessage(rating: number) {
  return `Thanks for rating this agent ${rating} star${rating === 1 ? "" : "s"}`
}
