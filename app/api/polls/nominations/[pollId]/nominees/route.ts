/**
 * app/api/polls/nominations/[pollId]/nominees/route.ts
 *
 * GET /api/polls/nominations/:pollId/nominees?categoryId=xxx
 *
 * Owner-only. Powers the "Import from Nominees" dialog on the main poll
 * creator: lists nominees (with nomination counts) for a given category
 * of one of the caller's own nomination polls, sorted by count desc.
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

export async function GET(req: NextRequest, { params }: { params: Promise<{ pollId: string }> }) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth
  const { userId } = auth
  const { pollId } = await params
  const categoryId = req.nextUrl.searchParams.get("categoryId")

  try {
    const pollSnap = await adminDb.collection("nominationPolls").doc(pollId).get()
    if (!pollSnap.exists) return fail("Nomination poll not found", 404)
    if (pollSnap.data()?.creatorId !== userId) return fail("Not authorized to view these nominees", 403)

    let query = adminDb
      .collection("nominationPolls")
      .doc(pollId)
      .collection("nominees") as FirebaseFirestore.Query

    if (categoryId) query = query.where("categoryId", "==", categoryId)

    const snap = await query.orderBy("count", "desc").get()

    const nominees = snap.docs.map((doc) => {
      const d = doc.data()
      return {
        nomineeId: doc.id,
        categoryId: d.categoryId ?? "",
        name: d.displayName ?? d.name ?? "",
        count: d.count ?? 0,
      }
    })

    return ok({ nominees, categories: pollSnap.data()?.categories ?? [] })
  } catch (err: any) {
    console.error("[GET /api/polls/nominations/[pollId]/nominees] error:", err)
    return fail("Failed to fetch nominees", 500)
  }
}
