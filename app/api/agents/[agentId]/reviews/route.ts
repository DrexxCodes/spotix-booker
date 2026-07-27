/**
 * app/api/agents/[agentId]/reviews/route.ts
 * GET /api/agents/[agentId]/reviews
 *
 * Public-to-bookers listing of everyone's ratings/comments for an agent,
 * plus their revocation history (times another booker removed this agent
 * from an event, with the reason) — "bookers can also leave comments that
 * other bookers can see" and revocations are visible the same way, so a
 * booker deciding whether to accept this agent can see the full picture.
 * Any authenticated booker can read this; only the eligible booker who
 * wrote a given review can change it (see the rating route).
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

export async function GET(req: NextRequest, { params }: { params: Promise<{ agentId: string }> }) {
  const cookieStore = await cookies()
  const token = cookieStore.get("spotix_at")?.value
  if (!token) return fail("No access token", 401)
  try {
    await verifyAccessToken(token, "spotix-booker")
  } catch {
    return fail("Invalid or expired access token", 401)
  }

  const { agentId } = await params

  try {
    const [reviewsSnap, revocationsSnap, agentDoc] = await Promise.all([
      adminDb.collection("agentRatings").doc(agentId).collection("reviews").orderBy("updatedAt", "desc").limit(50).get(),
      adminDb.collection("agents").doc(agentId).collection("events").where("status", "==", "revoked").get(),
      adminDb.collection("agents").doc(agentId).get(),
    ])

    const reviews = reviewsSnap.docs.map((doc) => {
      const d = doc.data()
      return {
        bookerName: d.bookerName || "A booker",
        eventName: d.eventName || "",
        rating: d.rating,
        comment: d.comment || "",
        updatedAt: d.updatedAt?.toDate?.()?.toISOString() ?? null,
      }
    })

    const revocations = revocationsSnap.docs.map((doc) => {
      const d = doc.data()
      return {
        eventName: d.eventName || "",
        reason: d.revokedReason || "",
        revokedByName: d.revokedByName || "An organizer",
        revokedAt: d.revokedAt?.toDate?.()?.toISOString() ?? null,
      }
    })

    const agentData = agentDoc.data() || {}

    return ok({
      reviews,
      revocations,
      summary: { average: agentData.averageRating || 0, total: agentData.totalRatings || 0 },
    })
  } catch (e: any) {
    console.error("[GET agent reviews] failed", e)
    return fail("Failed to load reviews", 500)
  }
}
